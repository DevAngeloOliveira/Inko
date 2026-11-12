import argparse
import asyncio
import json
import math
import platform
import threading
import time
from collections import Counter, defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

SERVICES = ("catalogo", "usuarios", "circulacao", "relatorios")
SCENARIOS = {
    "normal": (10, 120),
    "saturation": (120, 30),
    "isolation": (12, 30),
    "soak": (10, 600),
}
GAUGES = (
    "process_resident_memory_bytes",
    "inko_gateway_inflight",
    "inko_gateway_upstream_inflight",
    "inko_gateway_client_buckets",
    "inko_gateway_event_loop_lag_seconds",
    "inko_gateway_admitted_total",
    "inko_gateway_upstream_attempts_total",
)


def percentile(values, fraction):
    return round(sorted(values)[math.ceil(fraction * len(values)) - 1] * 1000, 2)


async def sample(client):
    import httpx

    try:
        response = await client.get("/metrics")
        response.raise_for_status()
        result = {}
        for line in response.text.splitlines():
            name, separator, value = line.rpartition(" ")
            if separator and name.split("{", 1)[0] in GAUGES:
                result[name] = float(value)
        return result
    except (httpx.HTTPError, ValueError):
        return None


async def measure(args):
    import httpx

    rate, duration = SCENARIOS[args.scenario]
    duration = args.seconds or duration
    clock = asyncio.get_running_loop().time
    pending = set()
    latencies = defaultdict(list)
    outcomes = defaultdict(Counter)
    peaks = {}
    scrape_failures = 0
    dropped = sent = 0
    limits = httpx.Limits(max_connections=64, max_keepalive_connections=32)
    async with (
        httpx.AsyncClient(base_url=args.url, timeout=4, limits=limits, trust_env=False) as client,
        httpx.AsyncClient(base_url=args.url, timeout=2, trust_env=False) as monitoring,
    ):
        before = await sample(monitoring)

        async def ping(service):
            start = clock()
            try:
                response = await client.get(f"/api/v1/{service}/ping")
                code = str(response.status_code)
                if response.status_code == 503:
                    media_type = response.headers.get("content-type", "")
                    code += "_app" if media_type.startswith("application/problem+json") else "_server"
                outcomes[service][code] += 1
                latencies[service].append(clock() - start)
            except httpx.RequestError:
                outcomes[service]["network_error"] += 1

        async def observe():
            nonlocal scrape_failures
            while True:
                values = await sample(monitoring)
                if values is None:
                    scrape_failures += 1
                else:
                    for key, value in values.items():
                        peaks[key] = max(peaks.get(key, value), value)
                await asyncio.sleep(1)

        observer = asyncio.create_task(observe())
        origin = clock()
        try:
            for index in range(rate * duration):
                due = origin + index / rate
                await asyncio.sleep(max(0, due - clock()))
                if clock() - due > 0.1 or len(pending) >= 128:
                    dropped += 1
                    continue
                if args.scenario == "isolation":
                    service = "relatorios" if index % 6 < 5 else "circulacao"
                else:
                    service = SERVICES[index % len(SERVICES)]
                task = asyncio.create_task(ping(service))
                pending.add(task)
                task.add_done_callback(pending.discard)
                sent += 1
            await asyncio.gather(*pending)
        finally:
            observer.cancel()
            await asyncio.gather(observer, return_exceptions=True)
        await asyncio.sleep(args.cooldown)
        after = await sample(monitoring)
    print(json.dumps({
        "scenario": args.scenario,
        "source": args.source,
        "environment": platform.platform(),
        "python": platform.python_version(),
        "target": args.url,
        "rate": rate,
        "duration_s": duration,
        "scheduled": rate * duration,
        "sent": sent,
        "dropped": dropped,
        "results": {
            service: {
                "outcomes": dict(counts),
                "p95_ms": percentile(latencies[service], .95) if latencies[service] else None,
                "p99_ms": percentile(latencies[service], .99) if latencies[service] else None,
            }
            for service, counts in outcomes.items()
        },
        "metrics_before": before,
        "metrics_peak": peaks,
        "metrics_after": after,
        "scrape_failures": scrape_failures,
    }, indent=2))


class StubHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle(self):
        try:
            super().handle()
        except ConnectionError:
            pass

    def do_GET(self):
        if self.path == "/actuator/health":
            payload = b'{"status":"UP"}'
        elif self.path == "/api/v1/ping":
            if self.server.report_delay:
                time.sleep(self.server.report_delay)
            payload = b'{"status":"ok"}'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_args):
        pass


def serve(bind, first_port, report_delay):
    servers = [ThreadingHTTPServer((bind, port), StubHandler) for port in range(first_port, first_port + 4)]
    for index, server in enumerate(servers):
        server.report_delay = report_delay if SERVICES[index] == "relatorios" else 0
        threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        threading.Event().wait()
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("scenario", choices=(*SCENARIOS, "stub"))
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--report-delay", type=float, default=1.5)
    parser.add_argument("--first-port", type=int, default=8081)
    parser.add_argument("--seconds", type=int)
    parser.add_argument("--cooldown", type=float, default=12)
    parser.add_argument("--source", default="unknown")
    args = parser.parse_args()
    if (
        (args.seconds is not None and args.seconds <= 0)
        or not math.isfinite(args.cooldown) or args.cooldown < 0
        or not math.isfinite(args.report_delay) or args.report_delay < 0
    ):
        parser.error("seconds must be positive and delays must be finite and nonnegative")
    if args.scenario == "stub":
        if not 1 <= args.first_port <= 65532:
            parser.error("the first stub port must leave room for four listeners")
        serve(args.bind, args.first_port, args.report_delay)
    else:
        target = urlsplit(args.url)
        if (
            target.scheme != "http" or target.hostname not in {"127.0.0.1", "::1"}
            or target.username is not None or target.path not in {"", "/"}
            or target.query or target.fragment
        ):
            parser.error("the measurement target must be a local HTTP loopback origin")
        asyncio.run(measure(args))


if __name__ == "__main__":
    main()
