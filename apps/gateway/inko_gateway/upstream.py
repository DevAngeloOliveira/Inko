import asyncio
import json
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from http.cookiejar import CookieJar, DefaultCookiePolicy

import httpx
from starlette.responses import Response


class RejectCookies(DefaultCookiePolicy):
    def set_ok(self, cookie, request):
        return False

    def return_ok(self, cookie, request):
        return False


class UpstreamPayloadError(Exception):
    pass


TRACEPARENT = re.compile(r"00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}")


def traceparent(values):
    matched = TRACEPARENT.fullmatch(values[0]) if len(values) == 1 else None
    if matched and matched[1] != "0" * 32 and matched[2] != "0" * 16:
        return matched[0]
    trace_id = secrets.randbelow((1 << 128) - 1) + 1
    parent_id = secrets.randbelow((1 << 64) - 1) + 1
    return f"00-{trace_id:032x}-{parent_id:016x}-00"


def make_client(policy, plane, transport_factory):
    if transport_factory is None:
        transport = httpx.AsyncHTTPTransport(
            http1=True, http2=False, trust_env=False, retries=0,
            limits=httpx.Limits(
                max_connections=policy.slots if plane == "business" else 1,
                max_keepalive_connections=policy.keepalive if plane == "business" else 1,
            ),
        )
    else:
        transport = transport_factory(policy.name, plane, policy)
    return httpx.AsyncClient(
        base_url=policy.url, transport=transport, trust_env=False,
        follow_redirects=False, cookies=CookieJar(policy=RejectCookies()),
        headers={"Accept-Encoding": "identity"},
    )


async def read_response(response, maximum):
    if response.headers.get("content-encoding", "identity").lower() != "identity":
        raise UpstreamPayloadError("encoding")
    if response.headers.get("content-length", "").isdigit():
        declared = response.headers["content-length"].lstrip("0") or "0"
        if len(declared) > len(str(maximum)) or int(declared) > maximum:
            raise UpstreamPayloadError("size")
    body = bytearray()
    async for chunk in response.aiter_bytes():
        if len(body) + len(chunk) > maximum:
            raise UpstreamPayloadError("size")
        body.extend(chunk)
    return bytes(body)


class BufferedResponse(Response):
    async def __call__(self, scope, receive, send):
        await send({"type": "http.response.start", "status": self.status_code, "headers": self.raw_headers})
        block_size = 16384
        for offset in range(0, len(self.body), block_size):
            await send({
                "type": "http.response.body",
                "body": self.body[offset:offset + block_size],
                "more_body": True,
            })
        await send({"type": "http.response.body", "body": b""})


async def ping(client, request, settings, deadline, begin_attempt):
    request_headers = {b"x-request-id": request.state.gateway_id.encode("ascii")}
    hop_headers = {
        item.strip().lower()
        for value in request.headers.getlist("connection")
        for item in value.split(",")
    }
    accept = [value for name, value in request.headers.raw if name == b"accept"]
    if accept and "accept" not in hop_headers:
        request_headers[b"accept"] = b", ".join(accept)
    context = [] if "traceparent" in hop_headers else request.headers.getlist("traceparent")
    request_headers[b"traceparent"] = traceparent(context).encode("ascii")
    remaining = deadline - asyncio.get_running_loop().time()
    if remaining <= 0:
        raise TimeoutError
    timeout = httpx.Timeout(
        connect=min(remaining, settings.connect_timeout),
        pool=min(remaining, settings.pool_timeout),
        write=min(remaining, settings.write_timeout),
        read=min(remaining, settings.read_timeout),
    )
    begin_attempt()
    async with client.stream("GET", "/api/v1/ping", headers=request_headers, timeout=timeout) as upstream:
        status = upstream.status_code
        if not (200 <= status < 300 or 400 <= status < 600):
            raise UpstreamPayloadError("status")
        body = await read_response(upstream, settings.response_bytes)
        response = BufferedResponse(body, status_code=status)
        hop_headers = {
            item.strip().lower()
            for name, value in upstream.headers.raw
            if name.lower() == b"connection"
            for item in value.split(b",")
        }
        for name, value in upstream.headers.raw:
            name = name.lower()
            if name in (b"content-type", b"retry-after", b"etag") and name not in hop_headers:
                response.raw_headers.append((name, value))
        return response


@dataclass(frozen=True, slots=True)
class HealthSnapshot:
    observed_at: str
    completed: float
    services: tuple[tuple[str, str], ...]

    def response(self, now, settings):
        age = max(0.0, now - self.completed)
        return {
            "observedAt": self.observed_at,
            "ageMs": int(age * 1000),
            "stale": age > settings.stale_after,
            "refreshIntervalMs": int(settings.probe_interval * 1000),
            "services": [{"service": name, "status": status} for name, status in self.services],
        }


async def probe(client, service, cutoff, settings, metrics, clock):
    started = clock()
    metrics.attempts.labels(service, "control").inc()
    with metrics.upstream_inflight.labels(service, "control").track_inprogress():
        try:
            async with asyncio.timeout_at(cutoff):
                async with client.stream("GET", "/actuator/health", timeout=settings.probe_timeout) as response:
                    if response.status_code == 200:
                        payload = json.loads(await read_response(response, settings.probe_bytes))
                        if isinstance(payload, dict) and payload.get("status") == "UP":
                            return service, "up"
        except httpx.PoolTimeout:
            metrics.pool_timeouts.labels(service, "control").inc()
        except UpstreamPayloadError as exc:
            metrics.payload_rejections.labels("probe", exc.args[0]).inc()
        except (TimeoutError, httpx.HTTPError, httpx.InvalidURL, ValueError, RecursionError):
            pass
        finally:
            metrics.upstream_duration.labels(service, "control").observe(max(0.0, clock() - started))
    return service, "down"


async def refresh_snapshot(runtime):
    loop = asyncio.get_running_loop()
    started = loop.time()
    cutoff = started + runtime.settings.probe_timeout
    statuses = await asyncio.gather(*(
        probe(client, service, cutoff, runtime.settings, runtime.metrics, runtime.clock)
        for service, client in runtime.probes.items()
    ))
    runtime.snapshot = HealthSnapshot(datetime.now(UTC).isoformat(), runtime.clock(), tuple(statuses))
    return started


async def schedule_snapshots(runtime, last_started):
    loop = asyncio.get_running_loop()
    while True:
        scheduled = last_started + runtime.settings.probe_interval
        await asyncio.sleep(max(0.0, scheduled - loop.time()))
        runtime.metrics.event_loop_lag.set(max(0.0, loop.time() - scheduled))
        last_started = await refresh_snapshot(runtime)
