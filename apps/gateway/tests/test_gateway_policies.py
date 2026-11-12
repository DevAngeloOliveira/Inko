import asyncio
import re
from collections import Counter
from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient

from inko_gateway.config import GatewaySettings
from inko_gateway.main import create_app
from inko_gateway.resilience import CircuitBreaker, RateLimiter

from test_gateway_http import ping, problem


def test_rate_limits_and_fixed_cardinality():
    clock = [100.0]
    settings = replace(GatewaySettings(), probe_interval=14)
    calls = Counter()

    def transport(service, plane, policy):
        def upstream(request):
            calls[(service, plane)] += 1
            return httpx.Response(200, json={"status": "UP" if plane != "business" else "ok"})

        return httpx.MockTransport(upstream)

    app = create_app(settings, clock=lambda: clock[0], transport_factory=transport)
    with TestClient(app, client=("198.51.100.1", 45000)) as client:
        for _ in range(16):
            assert client.get(ping("catalogo")).status_code == 200
        blocked = client.get(ping("catalogo"), headers={"x-forwarded-for": "203.0.113.8"})
        problem(blocked, 429, "RATE_LIMITED")
        assert blocked.headers["retry-after"] == "1"
        assert calls["catalogo", "business"] == 16
        clock[0] += 1
        assert client.get(ping("catalogo")).status_code == 200
        for index in range(100):
            assert client.request(f"CUSTOM{index}", "/api/v1/catalogo/missing").status_code in {404, 429}
        metrics = client.get("/metrics").text
        assert "inko_gateway_inflight" in metrics
        assert "inko_gateway_admitted_total" in metrics
        assert "inko_gateway_event_loop_lag_seconds" in metrics
        assert "CUSTOM" not in metrics
        assert "203.0.113.8" not in metrics
        assert "/api/v1/catalogo/missing" not in metrics


def test_upstream_headers_only_include_allowed_metadata():
    seen = []
    valid_trace = "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"

    def transport(service, plane, policy):
        def upstream(request):
            if plane == "business":
                seen.append(request.headers)
            return httpx.Response(200, json={"status": "UP"})

        return httpx.MockTransport(upstream)

    app = create_app(GatewaySettings(), transport_factory=transport)
    with TestClient(app) as client:
        response = client.get(ping("catalogo"), headers={
            "traceparent": valid_trace, "x-request-id": "trace-test",
            "authorization": "Bearer fixture", "cookie": "session=fixture", "x-forwarded-for": "192.0.2.1",
        })
        assert response.status_code == 200
        assert response.headers["x-request-id"] == "trace-test"
        response = client.get(ping("catalogo"), headers={"traceparent": "invalid"})
        assert response.status_code == 200

    assert seen[0]["traceparent"] == valid_trace
    assert seen[0]["x-request-id"] == "trace-test"
    assert seen[0]["accept-encoding"] == "identity"
    assert {"authorization", "cookie", "x-forwarded-for"}.isdisjoint(seen[0])
    assert re.fullmatch(r"00-[0-9a-f]{32}-[0-9a-f]{16}-00", seen[1]["traceparent"])


def test_breaker_transitions_only_for_eligible_results():
    clock = [100.0]
    settings = replace(
        GatewaySettings(), probe_interval=14, global_burst=128, client_burst=128
    )
    calls = Counter()
    codes = iter([503, 503, 429, 503, 503, 503, 200, 200])

    def transport(service, plane, policy):
        def upstream(request):
            calls[(service, plane)] += 1
            if plane != "business":
                return httpx.Response(200, json={"status": "UP"})
            return httpx.Response(next(codes), json={"status": "response"})

        return httpx.MockTransport(upstream)

    app = create_app(settings, clock=lambda: clock[0], transport_factory=transport)
    with TestClient(app) as client:
        for expected in (503, 503, 429, 503, 503, 503):
            response = client.get(ping("catalogo"))
            assert response.status_code == expected
            assert response.json() == {"status": "response"}
        problem(client.get(ping("catalogo")), 503, "UPSTREAM_CIRCUIT_OPEN")
        assert calls["catalogo", "business"] == 6
        clock[0] += 10.001
        assert client.get(ping("catalogo")).status_code == 200
        assert client.get(ping("catalogo")).status_code == 200
        assert calls["catalogo", "business"] == 8


def test_only_one_concurrent_half_open_attempt():
    async def scenario():
        clock = [100.0]
        settings = replace(GatewaySettings(), probe_interval=14)
        entered = asyncio.Event()
        release = asyncio.Event()
        attempts = 0

        def transport(service, plane, policy):
            async def upstream(request):
                nonlocal attempts
                if plane != "business":
                    return httpx.Response(200, json={"status": "UP"})
                attempts += 1
                if attempts <= 5:
                    return httpx.Response(503)
                if attempts == 6:
                    entered.set()
                    await release.wait()
                return httpx.Response(200)

            return httpx.MockTransport(upstream)

        app = create_app(settings, clock=lambda: clock[0], transport_factory=transport)
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://gateway") as client:
                for _ in range(5):
                    assert (await client.get(ping("catalogo"))).status_code == 503
                clock[0] += 10.001
                async with asyncio.TaskGroup() as group:
                    recovery = group.create_task(client.get(ping("catalogo")))
                    try:
                        async with asyncio.timeout(0.5):
                            await entered.wait()
                        concurrent = await asyncio.gather(*(client.get(ping("catalogo")) for _ in range(4)))
                        for response in concurrent:
                            problem(response, 503, "UPSTREAM_CIRCUIT_OPEN")
                        assert attempts == 6
                    finally:
                        release.set()
                assert recovery.result().status_code == 200
                assert (await client.get(ping("catalogo"))).status_code == 200
                assert attempts == 7

    asyncio.run(scenario())


def test_one_attempt_per_admitted_request_with_2000_requests():
    async def scenario():
        settings = replace(
            GatewaySettings(), probe_interval=14, global_burst=4096, client_burst=4096
        )
        calls = Counter()

        def transport(service, plane, policy):
            def upstream(request):
                if plane == "business":
                    calls[request.headers["x-request-id"]] += 1
                return httpx.Response(200, json={"status": "ok" if plane == "business" else "UP"})

            return httpx.MockTransport(upstream)

        app = create_app(settings, transport_factory=transport)
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://gateway") as client:
                for index in range(2_000):
                    request_id = f"attempt-{index}"
                    response = await client.get(ping("usuarios"), headers={"x-request-id": request_id})
                    assert response.status_code == 200
                    assert response.headers["x-request-id"] == request_id
        assert calls == {f"attempt-{index}": 1 for index in range(2_000)}

    asyncio.run(scenario())


def test_stale_breaker_result_cannot_close_a_new_generation():
    breaker = CircuitBreaker(GatewaySettings())
    old = breaker.permit(100)
    for _ in range(5):
        breaker.finish(breaker.permit(100), "failure", 100)
    recovery = breaker.permit(110)
    assert recovery != old
    assert breaker.state == "half_open"
    breaker.finish(old, "success", 110)
    assert breaker.state == "half_open"
    breaker.finish(recovery, "neutral", 110)
    assert breaker.permit(110.9) is None
    assert breaker.permit(111) is not None


def test_global_quota_client_overflow_and_expiry_are_bounded():
    defaults = GatewaySettings()
    default_limiter = RateLimiter(defaults, 100)
    for index in range(32):
        assert default_limiter.check(f"peer-{index}", 100) is None
    assert default_limiter.check("another-peer", 100) == ("global", 1)

    limiter = RateLimiter(replace(defaults, global_burst=2048), 100)
    for index in range(1024):
        assert limiter.check(f"peer-{index}", 100) is None
    for index in range(5):
        assert limiter.check(f"overflow-{index}", 100) is None
    assert limiter.check("overflow-next", 100) == ("overflow", 1)
    assert len(limiter.clients) == 1024
    assert limiter.check("fresh-peer", 220) is None
    assert list(limiter.clients) == ["fresh-peer"]


def test_startup_configuration_rejects_invalid_slot_budget(monkeypatch):
    monkeypatch.setenv("INKO_GATEWAY_BUSINESS_SLOTS", "37")
    with pytest.raises(ValueError, match="sum of service slots"):
        GatewaySettings.from_env()


def test_shutdown_cancels_scheduled_probes_and_closes_every_pool():
    async def scenario():
        settings = replace(GatewaySettings(), probe_timeout=0.2, probe_interval=0.21)
        calls = Counter()
        started = set()
        stopped = set()
        closed = set()
        cycle_inflight = asyncio.Event()

        class ProbeTransport(httpx.MockTransport):
            def __init__(self, service, plane):
                self.key = (service, plane)
                super().__init__(self.upstream)

            async def upstream(self, request):
                calls[self.key] += 1
                if calls[self.key] > 1:
                    started.add(self.key)
                    if len(started) == 4:
                        cycle_inflight.set()
                    try:
                        await asyncio.Event().wait()
                    finally:
                        stopped.add(self.key)
                return httpx.Response(200, json={"status": "UP"})

            async def aclose(self):
                closed.add(self.key)

        def transport(service, plane, policy):
            return ProbeTransport(service, plane)

        app = create_app(settings, transport_factory=transport)
        async with app.router.lifespan_context(app):
            async with asyncio.timeout(1):
                await cycle_inflight.wait()
        assert len(started) == 4
        assert started == stopped
        assert len(closed) == 8

    asyncio.run(scenario())


@pytest.mark.parametrize(
    ("path", "parallel", "code"),
    [(ping("catalogo"), 1, "UPSTREAM_CAPACITY_EXHAUSTED"), ("/health", 6, "GATEWAY_OVERLOADED")],
)
def test_stalled_send_keeps_slots_until_response_deadline(path, parallel, code):
    async def scenario():
        defaults = GatewaySettings()
        catalogo, *others = defaults.services
        settings = replace(
            defaults,
            services=(replace(catalogo, slots=1, keepalive=1), *others),
            business_slots=27,
            deadline=0.4,
        )

        def transport(service, plane, policy):
            return httpx.MockTransport(lambda request: httpx.Response(200, json={"status": "UP"}))

        app = create_app(settings, transport_factory=transport)
        scope = {
            "type": "http", "http_version": "1.1", "scheme": "http", "method": "GET",
            "path": path, "raw_path": path.encode(), "query_string": b"",
            "root_path": "", "headers": [], "client": ("127.0.0.1", 5000),
            "server": ("gateway", 80), "asgi": {"version": "3.0", "spec_version": "2.4"},
        }
        statuses = []
        sending = asyncio.Event()
        sends = 0

        async def hold_request():
            body_read = False

            async def receive():
                nonlocal body_read
                if not body_read:
                    body_read = True
                    return {"type": "http.request", "body": b"", "more_body": False}
                await asyncio.Event().wait()

            async def send(message):
                nonlocal sends
                if message["type"] == "http.response.start":
                    statuses.append(message["status"])
                elif message["type"] == "http.response.body":
                    sends += 1
                    if sends == parallel:
                        sending.set()
                    await asyncio.Event().wait()

            with pytest.raises(TimeoutError):
                await app(scope.copy(), receive, send)

        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://gateway") as client:
                async with asyncio.TaskGroup() as group:
                    for _ in range(parallel):
                        group.create_task(hold_request())
                    async with asyncio.timeout(1):
                        await sending.wait()
                    problem(await client.get(path), 503, code)
                    other_plane = "/health" if path == ping("catalogo") else ping("catalogo")
                    assert (await client.get(other_plane)).status_code == 200
                assert statuses == [200] * parallel
                assert (await client.get(path)).status_code == 200

    asyncio.run(scenario())


@pytest.mark.parametrize(
    ("phase", "status", "code", "attempts"),
    [("request", 408, "REQUEST_TIMEOUT", 0), ("upstream", 504, "UPSTREAM_TIMEOUT", 1)],
)
def test_cofired_deadlines_keep_the_preheader_error(phase, status, code, attempts, monkeypatch):
    async def scenario():
        loop = asyncio.get_running_loop()
        monotonic = loop.time
        lag = 0.0
        monkeypatch.setattr(loop, "time", lambda: monotonic() + lag)
        settings = replace(GatewaySettings(), deadline=0.2)
        calls = 0
        starts = []

        async def skip_both_deadlines():
            nonlocal lag
            lag += 0.3
            await asyncio.Event().wait()

        async def request_body():
            await skip_both_deadlines()
            yield b""

        def transport(service, plane, policy):
            async def upstream(request):
                nonlocal calls
                if plane == "business":
                    calls += 1
                    if phase == "upstream":
                        await skip_both_deadlines()
                return httpx.Response(200, json={"status": "UP"})

            return httpx.MockTransport(upstream)

        app = create_app(settings, transport_factory=transport)

        async def tracked_app(scope, receive, send):
            async def tracked_send(event):
                if event["type"] == "http.response.start":
                    starts.append(event["status"])
                await send(event)

            await app(scope, receive, tracked_send)

        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=tracked_app, raise_app_exceptions=False),
                base_url="http://gateway",
            ) as client:
                body = request_body() if phase == "request" else None
                response = await client.request("GET", ping("catalogo"), content=body)
                problem(response, status, code)
                assert response.headers["connection"] == "close"

        assert calls == attempts
        assert starts == [status]

    asyncio.run(scenario())
