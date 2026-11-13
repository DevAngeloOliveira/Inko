import asyncio
import contextlib
import importlib.util
import io
import socket
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx


SPEC = importlib.util.spec_from_file_location("measure_gateway", Path(__file__).with_name("measure-gateway.py"))
benchmark = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = benchmark
SPEC.loader.exec_module(benchmark)


class ContractTests(unittest.TestCase):
    def test_cli_rejects_invalid_args_before_starting(self):
        cases = (
            ["normal", "--port", "0"],
            ["normal", "--port", "65536"],
            ["normal", "--port", "text"],
            ["normal", "--family", "other"],
            ["normal", "--url", "http://example.invalid"],
            ["normal", "--seconds", "1801"],
            ["saturation", "--seconds", "834"],
            ["normal", "--cooldown", "nan"],
            ["stub", "--report-delay", "inf"],
            ["stub", "--first-port", "65533"],
            ["stub", "--bind", "0.0.0.0"],
        )
        for argv in cases:
            with (
                self.subTest(argv=argv),
                contextlib.redirect_stderr(io.StringIO()),
                patch.object(benchmark, "measure") as measure,
                patch.object(benchmark, "serve") as serve,
            ):
                with self.assertRaises(SystemExit) as error:
                    benchmark.main(argv)
                self.assertEqual(error.exception.code, 2)
                measure.assert_not_called()
                serve.assert_not_called()

    def test_target_reconstructs_literal_origins(self):
        self.assertEqual(benchmark.LocalTarget(benchmark.AddressFamily.IPV4, 8000).origin, "http://127.0.0.1:8000")
        self.assertEqual(benchmark.LocalTarget(benchmark.AddressFamily.IPV6, 65535).origin, "http://[::1]:65535")
        with self.assertRaises(ValueError):
            benchmark.LocalTarget(benchmark.AddressFamily.IPV4, True)

    def test_metrics_keep_labels_detect_resets_and_missing_series(self):
        raw = (
            b'# TYPE inko_gateway_admitted counter\n'
            b'inko_gateway_admitted_total 12\n'
            b'inko_gateway_inflight{plane="business"} 0\n'
            b'inko_gateway_inflight{plane="control"} 2\n'
        )
        before = benchmark.parse_metrics(raw)
        self.assertEqual(before['inko_gateway_inflight{plane="control"}'], 2)
        scrapes = benchmark.Scrapes()
        scrapes.record(before)
        scrapes.record({"inko_gateway_admitted_total": 2})
        scrapes.record(before)
        report = scrapes.report(before, before, 1)
        self.assertEqual(report["reset_series"], ["inko_gateway_admitted_total"])
        self.assertIn('inko_gateway_inflight{plane="control"}', report["missing_series"])
        self.assertIsNone(report["counter_deltas"]["inko_gateway_admitted_total"])
        with self.assertRaises(ValueError):
            benchmark.parse_metrics(b'inko_gateway_inflight{plane="control"} NaN')

    def test_process_restart_invalidates_deltas_even_if_counters_increase(self):
        before = {"process_start_time_seconds": 100, "inko_gateway_admitted_total": 12}
        after = {"process_start_time_seconds": 105, "inko_gateway_admitted_total": 16}
        scrapes = benchmark.Scrapes()
        scrapes.record(before)
        scrapes.record(after)
        report = scrapes.report(before, after, 1)
        self.assertTrue(report["process_restarted"])
        self.assertIsNone(report["counter_deltas"]["inko_gateway_admitted_total"])

    def test_only_known_lazy_counters_infer_zero_on_same_process(self):
        rejection = 'inko_gateway_rate_rejections_total{scope="global"}'
        timeout = 'inko_gateway_pool_timeouts_total{plane="business",service="catalogo"}'
        unexpected = 'inko_gateway_rate_rejections_total{scope="unknown"}'
        absent_after = 'inko_gateway_pool_timeouts_total{plane="business",service="usuarios"}'
        start = "process_start_time_seconds"
        before = {start: 100}
        after = {start: 100, rejection: 4, timeout: 1, unexpected: 2, "inko_gateway_admitted_total": 10}
        scrapes = benchmark.Scrapes()
        for sample in (before, {**after, timeout: 3, absent_after: 1}, after):
            scrapes.record(sample)
        report = scrapes.report(before, after, 1)
        self.assertEqual(report["inferred_zero_baseline"], [rejection])
        self.assertEqual(report["counter_deltas"][rejection], 4)
        for key in (timeout, unexpected, absent_after, "inko_gateway_admitted_total"):
            self.assertIsNone(report["counter_deltas"][key])
        self.assertIsNone(scrapes.report({}, after, 1)["counter_deltas"][rejection])
        self.assertIsNone(scrapes.report(before, {**after, start: 101}, 1)["counter_deltas"][rejection])
        self.assertIn('inko_gateway_inflight{plane="business"}', report["missing_series"])
        self.assertFalse(report["boundaries_complete"])

    def test_partial_stub_startup_releases_first_listener(self):
        created = []
        original = benchmark.StubServer

        def bind_first_then_fail(address, delay):
            if created:
                raise OSError("listener unavailable")
            created.append(original(("127.0.0.1", 0), delay))
            return created[0]

        with patch.object(benchmark, "StubServer", side_effect=bind_first_then_fail):
            with self.assertRaises(OSError):
                benchmark.serve("127.0.0.1", 8081, 0)
        self.assertEqual(created[0].socket.fileno(), -1)


class FixtureHandler(benchmark.StubHandler):
    def do_GET(self):
        if self.path == "/metrics":
            self.send_error(503)
        elif self.path.startswith("/api/v1/usuarios/"):
            self.respond(503, b'{"code":"UPSTREAM_CIRCUIT_OPEN"}', "application/problem+json")
        elif self.path.startswith("/api/v1/relatorios/"):
            self.respond(503, b"Service Unavailable")
        elif self.path.startswith("/api/v1/circulacao/"):
            self.respond(302, b"", location="/redirected")
        elif self.path == "/redirected":
            self.server.redirects += 1
            self.respond(200, b"")
        else:
            self.respond(200, b'{"status":"ok"}')

    def respond(self, status, payload, media_type="text/plain", location=None):
        self.send_response(status)
        self.send_header("Content-Type", media_type)
        self.send_header("Content-Length", str(len(payload)))
        if location:
            self.send_header("Location", location)
        self.end_headers()
        self.wfile.write(payload)


class MeasurementTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_loopback_scenario_keeps_503_reasons_and_reports_failed_scrape(self):
        await self.assert_loopback(benchmark.StubServer, benchmark.AddressFamily.IPV4, "127.0.0.1")

    async def test_ipv6_loopback_when_supported(self):
        class IPv6Server(benchmark.StubServer):
            address_family = socket.AF_INET6

        try:
            with socket.socket(socket.AF_INET6) as probe:
                probe.bind(("::1", 0))
        except OSError:
            self.skipTest("IPv6 loopback unavailable")
        await self.assert_loopback(IPv6Server, benchmark.AddressFamily.IPV6, "::1")

    async def assert_loopback(self, server_type, family, address):
        server = server_type((address, 0), 0)
        server.RequestHandlerClass = FixtureHandler
        server.redirects = 0
        worker = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        worker.start()
        try:
            target = benchmark.LocalTarget(family, server.server_port)
            args = benchmark.parse_args(["normal", "--seconds", "1", "--cooldown", "0"])
            proxy = {"HTTP_PROXY": "http://127.0.0.1:1", "ALL_PROXY": "http://127.0.0.1:1", "NO_PROXY": ""}
            with patch.dict("os.environ", proxy), patch.object(benchmark, "MAX_LAG", 5):
                report = await benchmark.measure(args, target)
            self.assertEqual(report["scheduled"], 10)
            self.assertEqual(report["sent"] + report["dropped"], report["scheduled"])
            self.assertEqual(report["sent"], sum(report["outcomes"].values()))
            self.assertEqual(report["outcomes"]["503_app_UPSTREAM_CIRCUIT_OPEN"], 3)
            self.assertEqual(report["outcomes"]["503_server"], 2)
            self.assertEqual(report["outcomes"]["302"], 2)
            self.assertEqual(server.redirects, 0)
            self.assertEqual(report["scrapes"]["coverage"], 0)
            self.assertEqual(report["scrapes"]["failed"], 1)
            self.assertIsNone(report["metrics_before"])
            self.assertEqual(report["target"], target.origin)
        finally:
            await asyncio.to_thread(server.shutdown)
            await asyncio.to_thread(worker.join)
            server.server_close()

    async def test_network_failure_and_timeout_keep_observed_latency(self):
        target = benchmark.LocalTarget(benchmark.AddressFamily.IPV4, 8000)
        args = benchmark.parse_args(["normal", "--seconds", "1", "--cooldown", "0"])
        with (
            patch.object(benchmark, "sample", AsyncMock(return_value=None)),
            patch.object(benchmark, "ping", AsyncMock(side_effect=["network_error", "pool_timeout"] * 5)),
            patch.object(benchmark, "MAX_LAG", 5),
        ):
            report = await benchmark.measure(args, target)
        self.assertEqual(report["outcomes"], {"network_error": 5, "pool_timeout": 5})
        self.assertEqual(report["generator"]["pool_timeouts"], 5)
        self.assertEqual(report["success_rate"], 0)
        for outcome in report["outcomes"]:
            self.assertIsNotNone(report["latency_by_outcome"][outcome]["client"]["p95_ms"])
            self.assertIsNotNone(report["latency_by_outcome"][outcome]["end_to_end"]["p99_ms"])

    async def test_drop_accounting_keeps_scheduled_arrivals_in_denominator(self):
        stats = benchmark.Results(scheduled=3, sent=2)
        stats.drops["pending_cap"] = 1
        stats.timings["200"].append((0.01, 0.01, 0.02))
        stats.timings["pool_timeout"].append((0.02, 0.08, 0.1))
        report = stats.report()
        self.assertAlmostEqual(report["success_rate"], 1 / 3)
        self.assertEqual(report["end_to_end"]["p95_ms"], 100)
        self.assertEqual(report["latency_by_outcome"]["200"]["client"]["p95_ms"], 10)

    async def test_cancellation_waits_for_outstanding_requests(self):
        target = benchmark.LocalTarget(benchmark.AddressFamily.IPV4, 8000)
        args = benchmark.parse_args(["normal", "--seconds", "1", "--cooldown", "0"])
        entered = asyncio.Event()
        cleaned = asyncio.Event()

        async def hold(*_args):
            entered.set()
            try:
                await asyncio.Future()
            finally:
                cleaned.set()

        with (
            patch.object(benchmark, "sample", AsyncMock(return_value=None)),
            patch.object(benchmark, "ping", side_effect=hold),
            patch.object(benchmark, "MAX_LAG", 10),
        ):
            task = asyncio.create_task(benchmark.measure(args, target))
            try:
                await asyncio.wait_for(entered.wait(), 10)
            finally:
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await asyncio.wait_for(task, 10)
        self.assertTrue(cleaned.is_set())

    async def test_transport_failures_remain_distinct_outcomes(self):
        for error, expected in (
            (httpx.PoolTimeout("pool"), "pool_timeout"),
            (httpx.ReadTimeout("read"), "client_timeout"),
            (httpx.ConnectError("connect"), "network_error"),
        ):
            with self.subTest(error=error):
                def fail(_request):
                    raise error
                transport = httpx.MockTransport(fail)
                async with httpx.AsyncClient(transport=transport, base_url="http://127.0.0.1") as client:
                    self.assertEqual(await benchmark.ping(client, "catalogo"), expected)


if __name__ == "__main__":
    unittest.main()
