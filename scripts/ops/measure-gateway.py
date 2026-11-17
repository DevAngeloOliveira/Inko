import argparse
import asyncio
import json
import math
import platform
import re
import threading
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from enum import Enum
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


SERVICES = ("catalogo", "usuarios", "circulacao", "relatorios")
SCENARIOS = {
    "normal": (10, 120),
    "saturation": (120, 30),
    "isolation": (12, 30),
    "soak": (10, 600),
}
MAX_SECONDS = 1800
MAX_ARRIVALS = 100_000
MAX_CONNECTIONS = 64
MAX_KEEPALIVE = 32
MAX_PENDING = 128
MAX_LAG = 0.1
CLIENT_TIMEOUT = 4
SCRAPE_INTERVAL = 1
SCRAPE_TIMEOUT = 2
MAX_SCRAPE_BYTES = 512 * 1024
MAX_SERIES = 128
COUNTERS = {
    "inko_gateway_admitted_total", "inko_gateway_upstream_attempts_total",
    "inko_gateway_admission_rejections_total", "inko_gateway_rate_rejections_total",
    "inko_gateway_pool_timeouts_total",
}
LAZY_COUNTER_SERIES = (
    {f'inko_gateway_admission_rejections_total{{reason="{reason}",service="{service}"}}'
     for reason in ("business", "pool", "service") for service in SERVICES}
    | {'inko_gateway_admission_rejections_total{reason="control",service="control"}'}
    | {f'inko_gateway_rate_rejections_total{{scope="{scope}"}}' for scope in ("global", "client", "overflow")}
    | {f'inko_gateway_pool_timeouts_total{{plane="{plane}",service="{service}"}}'
       for plane in ("business", "control") for service in SERVICES}
)
REQUIRED_SERIES = (
    {"process_start_time_seconds", "inko_gateway_admitted_total"}
    | {f'inko_gateway_inflight{{plane="{plane}"}}' for plane in ("business", "control")}
    | {f'inko_gateway_upstream_attempts_total{{plane="{plane}",service="{service}"}}'
       for plane in ("business", "control") for service in SERVICES}
    | {f'inko_gateway_upstream_inflight{{plane="{plane}",service="{service}"}}'
       for plane in ("business", "control") for service in SERVICES}
)
GAUGES = {
    "process_resident_memory_bytes", "process_start_time_seconds", "inko_gateway_inflight",
    "inko_gateway_upstream_inflight", "inko_gateway_client_buckets",
    "inko_gateway_event_loop_lag_seconds", "inko_gateway_circuit_state",
    "inko_gateway_status_snapshot_age_seconds",
}
APP_503 = {
    "GATEWAY_OVERLOADED", "UPSTREAM_CAPACITY_EXHAUSTED",
    "UPSTREAM_CIRCUIT_OPEN", "GATEWAY_SEND_TIMEOUT",
}


class AddressFamily(Enum):
    IPV4 = "ipv4"
    IPV6 = "ipv6"


@dataclass(frozen=True, slots=True)
class LocalTarget:
    family: AddressFamily
    port: int

    def __post_init__(self):
        if not isinstance(self.family, AddressFamily) or type(self.port) is not int or not 1 <= self.port <= 65535:
            raise ValueError("invalid local target")

    @property
    def origin(self):
        host = "127.0.0.1" if self.family is AddressFamily.IPV4 else "[::1]"
        return f"http://{host}:{self.port}"


def percentiles(values):
    ordered = sorted(values)
    return {
        f"p{percentile}_ms": round(ordered[math.ceil(percentile * len(ordered) / 100) - 1] * 1000, 2)
        if ordered else None
        for percentile in (95, 99)
    }


@dataclass(slots=True)
class Results:
    scheduled: int = 0
    sent: int = 0
    drops: Counter = field(default_factory=Counter)
    timings: dict = field(default_factory=lambda: defaultdict(list))

    def report(self):
        dropped = sum(self.drops.values())
        outcomes = {outcome: len(times) for outcome, times in sorted(self.timings.items())}
        if self.scheduled != self.sent + dropped or self.sent != sum(outcomes.values()):
            raise RuntimeError("inconsistent arrival accounting")
        all_times = [times for group in self.timings.values() for times in group]
        return {
            "scheduled": self.scheduled, "sent": self.sent, "dropped": dropped,
            "drop_reasons": dict(self.drops), "outcomes": outcomes,
            "success_rate": outcomes.get("200", 0) / self.scheduled if self.scheduled else None,
            "dispatch_lag": percentiles(times[0] for times in all_times),
            "end_to_end": percentiles(times[2] for times in all_times),
            "latency_by_outcome": {
                outcome: {
                    "client": percentiles(times[1] for times in group),
                    "end_to_end": percentiles(times[2] for times in group),
                }
                for outcome, group in sorted(self.timings.items())
            },
        }


def series_key(sample):
    if not sample.labels:
        return sample.name
    labels = ",".join(
        f"{key}={json.dumps(value, ensure_ascii=False)}"
        for key, value in sorted(sample.labels.items())
    )
    return f"{sample.name}{{{labels}}}"


def parse_metrics(payload):
    from prometheus_client.parser import text_string_to_metric_families

    values = {}
    for family in text_string_to_metric_families(payload.decode("utf-8")):
        for sample in family.samples:
            if sample.name not in COUNTERS | GAUGES:
                continue
            key = series_key(sample)
            if (
                key in values or len(values) >= MAX_SERIES
                or not math.isfinite(sample.value) or sample.value < 0
            ):
                raise ValueError("invalid or excessive metric series")
            values[key] = sample.value
    if not values:
        raise ValueError("no supported metrics")
    return values


async def read_limited(response, maximum):
    body = bytearray()
    async for chunk in response.aiter_raw():
        if len(chunk) + len(body) > maximum:
            raise ValueError("response exceeds measurement limit")
        body.extend(chunk)
    return bytes(body)


async def sample(client):
    import httpx

    try:
        async with asyncio.timeout(SCRAPE_TIMEOUT):
            async with client.stream("GET", "/metrics") as response:
                response.raise_for_status()
                return parse_metrics(await read_limited(response, MAX_SCRAPE_BYTES))
    except (TimeoutError, httpx.HTTPError, ValueError, IndexError):
        return None


@dataclass(slots=True)
class Scrapes:
    peaks: dict = field(default_factory=dict)
    latest_counters: dict = field(default_factory=dict)
    resets: set = field(default_factory=set)
    missing: set = field(default_factory=set)
    sampled: int = 0
    complete: int = 0
    failed: int = 0
    skipped: int = 0
    process_started_at: float | None = None
    process_restarted: bool = False

    def record(self, values):
        if values is None:
            return
        new_series = set(values) - self.peaks.keys()
        if len(self.peaks) + len(new_series) > MAX_SERIES:
            raise ValueError("too many distinct series in measurement")
        process_started_at = values.get("process_start_time_seconds")
        if process_started_at is not None:
            if self.process_started_at is not None and process_started_at != self.process_started_at:
                self.process_restarted = True
            self.process_started_at = process_started_at
        self.missing.update(self.peaks.keys() - values.keys())
        for key, value in values.items():
            self.peaks[key] = max(self.peaks.get(key, value), value)
            if key.split("{", 1)[0] in COUNTERS:
                previous = self.latest_counters.get(key)
                if previous is not None and value < previous:
                    self.resets.add(key)
                self.latest_counters[key] = value

    def report(self, before, after, duration):
        initial = before or {}
        final = after or {}
        process_started = initial.get("process_start_time_seconds")
        same_process = (
            process_started is not None and process_started > 0
            and process_started == final.get("process_start_time_seconds")
        )
        inferred_zero = (
            LAZY_COUNTER_SERIES.intersection(final) - initial.keys() - self.resets - self.missing
            if same_process and not self.process_restarted else set()
        )
        deltas = {
            key: final[key] - initial.get(key, 0)
            if (key in initial or key in inferred_zero) and key in final
            and key not in self.resets and not self.process_restarted else None
            for key in sorted(self.latest_counters)
        }
        admitted = deltas.get("inko_gateway_admitted_total")
        attempts = {}
        for plane in ("business", "control"):
            counts = [
                deltas.get(f'inko_gateway_upstream_attempts_total{{plane="{plane}",service="{service}"}}')
                for service in SERVICES
            ]
            attempts[plane] = sum(counts) if all(count is not None for count in counts) else None
        initial_idle = initial.get('inko_gateway_inflight{plane="business"}') == 0
        final_idle = final.get('inko_gateway_inflight{plane="business"}') == 0
        business = attempts["business"]
        return {
            "expected": duration, "successful": self.sampled, "failed": self.failed,
            "skipped": self.skipped, "coverage": self.complete / duration,
            "raw_coverage": self.sampled / duration,
            "failure_rate": self.failed / (self.sampled + self.failed) if self.sampled + self.failed else None,
            "boundaries_present": before is not None and after is not None,
            "boundaries_complete": REQUIRED_SERIES <= initial.keys() and REQUIRED_SERIES <= final.keys(),
            "process_restarted": self.process_restarted if self.process_started_at is not None else None,
            "missing_series": sorted(
                self.missing | (self.peaks.keys() - initial.keys() - inferred_zero) | (self.peaks.keys() - final.keys())
                | (REQUIRED_SERIES - initial.keys()) | (REQUIRED_SERIES - final.keys())
            ),
            "inferred_zero_baseline": sorted(inferred_zero),
            "reset_series": sorted(self.resets), "counter_deltas": deltas,
            "admissions": admitted, "attempts_by_plane": attempts,
            "business_attempts_within_admissions": business <= admitted
            if initial_idle and final_idle and admitted is not None and business is not None else None,
        }


async def observe(monitoring, origin, duration, scrapes):
    clock = asyncio.get_running_loop().time
    end = origin + duration
    for index in range(duration):
        due = origin + index * SCRAPE_INTERVAL
        await asyncio.sleep(max(0, due - clock()))
        if clock() - due >= SCRAPE_INTERVAL or clock() >= end:
            scrapes.skipped += 1
            continue
        try:
            async with asyncio.timeout_at(end):
                values = await sample(monitoring)
        except TimeoutError:
            scrapes.skipped += 1
            continue
        if clock() >= end:
            scrapes.skipped += 1
            continue
        if values is None:
            scrapes.failed += 1
            continue
        try:
            scrapes.record(values)
        except ValueError:
            scrapes.failed += 1
        else:
            scrapes.sampled += 1
            if REQUIRED_SERIES <= values.keys():
                scrapes.complete += 1
            else:
                scrapes.missing.update(REQUIRED_SERIES - values.keys())


async def ping(client, service):
    import httpx

    try:
        async with asyncio.timeout(CLIENT_TIMEOUT):
            async with client.stream("GET", f"/api/v1/{service}/ping") as response:
                status = response.status_code
                problem = response.headers.get("content-type", "").split(";", 1)[0].strip() == "application/problem+json"
                try:
                    body = await read_limited(response, 1024 * 1024)
                except ValueError:
                    return "oversize_response"
                if status != 503:
                    return str(status)
                if not problem:
                    return "503_upstream" if "x-request-id" in response.headers else "503_server"
                try:
                    payload = json.loads(body)
                except (ValueError, RecursionError):
                    return "503_app_unknown"
                code = payload.get("code") if isinstance(payload, dict) else None
                return f"503_app_{code}" if isinstance(code, str) and code in APP_503 else "503_app_unknown"
    except httpx.PoolTimeout:
        return "pool_timeout"
    except (TimeoutError, httpx.TimeoutException):
        return "client_timeout"
    except httpx.RequestError:
        return "network_error"


async def measure(args, target):
    import httpx

    rate, duration = SCENARIOS[args.scenario]
    duration = args.seconds if args.seconds is not None else duration
    clock = asyncio.get_running_loop().time
    pending = set()
    results = {service: Results() for service in SERVICES}
    scrapes = Scrapes()
    pending_peak = 0
    scheduler_lag_peak = 0
    options = {
        "base_url": target.origin, "trust_env": False, "follow_redirects": False,
        "headers": {"Accept-Encoding": "identity"},
    }
    limits = httpx.Limits(max_connections=MAX_CONNECTIONS, max_keepalive_connections=MAX_KEEPALIVE)
    async with (
        httpx.AsyncClient(**options, timeout=CLIENT_TIMEOUT, limits=limits) as client,
        httpx.AsyncClient(**options, timeout=SCRAPE_TIMEOUT,
                          limits=httpx.Limits(max_connections=1, max_keepalive_connections=1)) as monitoring,
    ):
        before = await sample(monitoring)
        scrapes.record(before)

        async def send_ping(service, scheduled_at):
            task_started_at = clock()
            outcome = await ping(client, service)
            completed_at = clock()
            results[service].timings[outcome].append((
                task_started_at - scheduled_at, completed_at - task_started_at, completed_at - scheduled_at,
            ))

        origin = clock()
        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(observe(monitoring, origin, duration, scrapes))
            for index in range(rate * duration):
                due = origin + index / rate
                await asyncio.sleep(max(0, due - clock()))
                lag = max(0, clock() - due)
                scheduler_lag_peak = max(scheduler_lag_peak, lag)
                if args.scenario == "isolation":
                    service = "relatorios" if index % 6 < 5 else "circulacao"
                else:
                    service = SERVICES[index % len(SERVICES)]
                stats = results[service]
                stats.scheduled += 1
                if lag > MAX_LAG:
                    stats.drops["scheduler_lag"] += 1
                    continue
                if len(pending) >= MAX_PENDING:
                    stats.drops["pending_cap"] += 1
                    continue
                task = tasks.create_task(send_ping(service, due))
                pending.add(task)
                pending_peak = max(pending_peak, len(pending))
                task.add_done_callback(pending.discard)
                stats.sent += 1
        await asyncio.sleep(args.cooldown)
        after = await sample(monitoring)
        try:
            scrapes.record(after)
        except ValueError:
            after = None

    by_service = {service: stats.report() for service, stats in results.items()}
    total = Results()
    for stats in results.values():
        total.scheduled += stats.scheduled
        total.sent += stats.sent
        total.drops.update(stats.drops)
        for outcome, times in stats.timings.items():
            total.timings[outcome].extend(times)
    if total.scheduled != rate * duration or scrapes.sampled + scrapes.failed + scrapes.skipped != duration:
        raise RuntimeError("inconsistent measurement accounting")
    return {
        "schema_version": 2, "scenario": args.scenario, "source": args.source,
        "image_ids": args.image_id, "environment": platform.platform(), "python": platform.python_version(),
        "target": target.origin, "rate": rate, "duration_s": duration, "cooldown_s": args.cooldown,
        "generator": {
            "max_connections": MAX_CONNECTIONS, "max_keepalive_connections": MAX_KEEPALIVE,
            "max_pending": MAX_PENDING, "client_timeout_s": CLIENT_TIMEOUT, "max_schedule_lag_ms": MAX_LAG * 1000,
            "peak_pending": pending_peak, "peak_schedule_lag_ms": round(scheduler_lag_peak * 1000, 2),
            "pool_timeouts": len(total.timings.get("pool_timeout", ())),
        },
        **total.report(), "results": by_service,
        "metrics_before": before, "metrics_peak": scrapes.peaks, "metrics_after": after,
        "scrapes": scrapes.report(before, after, duration),
    }


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


class StubServer(ThreadingHTTPServer):
    def __init__(self, address, report_delay):
        self.report_delay = report_delay
        self.connections = threading.BoundedSemaphore(32)
        super().__init__(address, StubHandler)

    def process_request(self, request, client_address):
        if not self.connections.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            request.settimeout(5)
            super().process_request(request, client_address)
        except BaseException:
            self.connections.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.connections.release()


def serve(bind, first_port, report_delay):
    servers = []
    started = []
    try:
        for index, service in enumerate(SERVICES):
            server = StubServer((bind, first_port + index), report_delay if service == "relatorios" else 0)
            servers.append(server)
        for server in servers:
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            started.append((server, worker))
        threading.Event().wait()
    finally:
        for server, worker in started:
            server.shutdown()
            worker.join()
        for server in servers:
            server.server_close()


def parse_args(argv=None):
    parser = argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument("scenario", choices=(*SCENARIOS, "stub"))
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--family", choices=[family.value for family in AddressFamily], default="ipv4")
    parser.add_argument("--bind", choices=("127.0.0.1", "0.0.0.0"), default="127.0.0.1")
    parser.add_argument("--isolated-docker", action="store_true")
    parser.add_argument("--report-delay", type=float, default=1.5)
    parser.add_argument("--first-port", type=int, default=8081)
    parser.add_argument("--seconds", type=int)
    parser.add_argument("--cooldown", type=float, default=12)
    parser.add_argument("--source", default="unknown")
    parser.add_argument("--image-id", action="append", default=[])
    args = parser.parse_args(argv)
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    if not 0 <= args.cooldown <= 300 or not 0 <= args.report_delay <= 10:
        parser.error("--cooldown must be between 0 and 300 s and --report-delay between 0 and 10 s")
    if args.seconds is not None and not 1 <= args.seconds <= MAX_SECONDS:
        parser.error(f"--seconds must be between 1 and {MAX_SECONDS}")
    if len(args.image_id) > 16 or any(
        not re.fullmatch(r"[A-Za-z0-9_.:+-]{1,128}", value)
        for value in [args.source, *args.image_id]
    ):
        parser.error("source and image IDs must be identifiers of at most 128 characters (up to 16 image IDs)")
    if args.scenario == "stub":
        if not 1 <= args.first_port <= 65532:
            parser.error("the first stub port must leave room for four listeners")
        if args.bind == "0.0.0.0" and not args.isolated_docker:
            parser.error("wildcard stub binding requires --isolated-docker and unpublished ports")
    else:
        rate, duration = SCENARIOS[args.scenario]
        if rate * (args.seconds or duration) > MAX_ARRIVALS:
            parser.error(f"at most {MAX_ARRIVALS} arrivals per run")
    return args


def main(argv=None):
    args = parse_args(argv)
    if args.scenario == "stub":
        try:
            serve(args.bind, args.first_port, args.report_delay)
        except KeyboardInterrupt:
            return
    else:
        target = LocalTarget(AddressFamily(args.family), args.port)
        print(json.dumps(asyncio.run(measure(args, target)), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
