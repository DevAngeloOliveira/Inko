import asyncio
import json
import socket
from collections import Counter
from contextlib import AsyncExitStack, asynccontextmanager
from dataclasses import replace

import httpx
import uvicorn

from inko_gateway.config import GatewaySettings
from inko_gateway.main import create_app


@asynccontextmanager
async def serve(app, *, concurrency=None):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        sock.listen()
        config = uvicorn.Config(
            app, http="h11", ws="none", lifespan="on", log_level="error", proxy_headers=False,
            limit_concurrency=concurrency, timeout_graceful_shutdown=1,
        )
        server = uvicorn.Server(config)
        task = asyncio.create_task(server.serve(sockets=[sock]))
        try:
            async with asyncio.timeout(5):
                while not server.started:
                    if task.done():
                        await task
                        raise RuntimeError("Uvicorn stopped before startup")
                    await asyncio.sleep(0.01)
            yield f"http://127.0.0.1:{sock.getsockname()[1]}"
        finally:
            server.should_exit = True
            async with asyncio.timeout(5):
                await task


class Upstream:
    def __init__(self, *, healthy=True):
        self.healthy = healthy
        self.calls = Counter()
        self.handler = self.respond

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            while True:
                message = await receive()
                await send({"type": message["type"] + ".complete"})
                if message["type"] == "lifespan.shutdown":
                    return
        path = scope["path"]
        self.calls[path] += 1
        if path == "/actuator/health":
            if self.healthy:
                await self.respond(send, {"status": "UP"})
            else:
                await self.respond(send, {"status": "DOWN"}, status=503)
        else:
            await self.handler(send)

    @staticmethod
    async def respond(send, payload=None, status=200, *, headers=()):
        if payload is None:
            payload = {"status": "ok"}
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), *headers],
        })
        await send({"type": "http.response.body", "body": json.dumps(payload).encode()})


@asynccontextmanager
async def gateway(*, clock=None, guard=None, service_slots=None, down_service=None, wrap_app=None, **overrides):
    async with AsyncExitStack() as stack:
        settings = GatewaySettings()
        upstreams = {
            policy.name: Upstream(healthy=policy.name != down_service)
            for policy in settings.services
        }
        policies = []
        for policy in settings.services:
            url = await stack.enter_async_context(serve(upstreams[policy.name]))
            slots = (service_slots or {}).get(policy.name, policy.slots)
            policies.append(replace(policy, url=url, slots=slots, keepalive=min(slots, policy.keepalive)))
        options = {
            "probe_interval": 14,
            "business_slots": sum(policy.slots for policy in policies),
            **overrides,
        }
        settings = replace(settings, services=tuple(policies), **options)
        app = create_app(settings, clock=clock)
        url = await stack.enter_async_context(serve(wrap_app(app) if wrap_app else app, concurrency=guard))
        client = await stack.enter_async_context(
            httpx.AsyncClient(base_url=url, timeout=4, trust_env=False, limits=httpx.Limits(
                max_connections=64, max_keepalive_connections=0,
            ))
        )
        yield client, upstreams


def ping(service):
    return f"/api/v1/{service}/ping"


def problem(response, status, code):
    assert response.status_code == status, response.text
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == code
    assert response.json()["requestId"] == response.headers["x-request-id"]


def test_real_http_admission_is_immediate_and_isolated():
    async def scenario():
        limits = {"catalogo": 12, "usuarios": 12, "circulacao": 8, "relatorios": 6}
        async with gateway(global_burst=128, client_burst=128) as (client, upstreams):
            entered = Counter()
            all_entered = {name: asyncio.Event() for name in limits}
            release = {name: asyncio.Event() for name in limits}

            def handler(name):
                async def hold(send):
                    entered[name] += 1
                    if entered[name] >= limits[name]:
                        all_entered[name].set()
                    await release[name].wait()
                    await Upstream.respond(send)
                return hold

            for name, upstream in upstreams.items():
                upstream.handler = handler(name)
            async with asyncio.TaskGroup() as group:
                try:
                    reports = [group.create_task(client.get(ping("relatorios"))) for _ in range(6)]
                    async with asyncio.timeout(1.5):
                        await all_entered["relatorios"].wait()
                    problem(
                        await client.get(ping("relatorios")), 503, "UPSTREAM_CAPACITY_EXHAUSTED"
                    )

                    other = [
                        group.create_task(client.get(ping(name)))
                        for name in ("catalogo", "usuarios", "circulacao")
                        for _ in range(limits[name])
                    ]
                    async with asyncio.timeout(1.5):
                        await asyncio.gather(*(event.wait() for event in all_entered.values()))
                    assert sum(entered.values()) == 38
                    rejected = await asyncio.gather(*(client.get(ping(name)) for name in limits))
                    assert all(response.status_code == 503 for response in rejected)
                    assert entered == limits
                    for name in limits.keys() - {"relatorios"}:
                        release[name].set()
                    assert all(response.status_code == 200 for response in await asyncio.gather(*other))
                    assert all(not task.done() for task in reports)
                    assert (await client.get("/health")).status_code == 200
                finally:
                    for event in release.values():
                        event.set()
            assert all(task.result().status_code == 200 for task in reports)
            assert (await client.get(ping("relatorios"))).status_code == 200
            assert entered["relatorios"] == 7

    asyncio.run(scenario())


def test_status_is_a_snapshot_and_does_not_probe_per_access():
    async def scenario():
        now = 1_000.0
        async with gateway(clock=lambda: now) as (client, upstreams):
            for _ in range(20):
                responses = await asyncio.gather(*(client.get("/api/v1/system/status") for _ in range(5)))
                for response in responses:
                    assert response.status_code == 200
                    status = response.json()
                    assert {row["service"]: row["status"] for row in status["services"]} == {
                        service: "up" for service in upstreams
                    }
                    assert status["stale"] is False
            assert all(upstream.calls == {"/actuator/health": 1} for upstream in upstreams.values())
            now += 16
            snapshot = (await client.get("/api/v1/system/status")).json()
            assert snapshot["stale"] is True
            assert snapshot["ageMs"] >= 16_000
            assert snapshot["observedAt"] == status["observedAt"]

    asyncio.run(scenario())


def test_status_burst_never_triggers_extra_probes():
    async def scenario():
        entered = asyncio.Event()
        release = asyncio.Event()

        def hold_first_snapshot(app):
            async def wrapper(scope, receive, send):
                if scope["type"] != "http" or (b"x-test-hold-status", b"1") not in scope["headers"]:
                    await app(scope, receive, send)
                    return

                async def hold(send_event):
                    if send_event["type"] == "http.response.start":
                        entered.set()
                        await release.wait()
                    await send(send_event)

                await app(scope, receive, hold)

            return wrapper

        async with gateway(guard=64, deadline=5, wrap_app=hold_first_snapshot) as (client, upstreams):
            url = "/api/v1/system/status"
            expected = (await client.get(url)).json()
            async with httpx.AsyncClient(
                base_url=client.base_url, timeout=6, trust_env=False,
                limits=httpx.Limits(max_connections=100, max_keepalive_connections=0),
            ) as burst:
                async with asyncio.TaskGroup() as group:
                    first = group.create_task(burst.get(url, headers={"x-test-hold-status": "1"}))
                    try:
                        async with asyncio.timeout(1):
                            await entered.wait()
                        responses = await asyncio.gather(*(burst.get(url) for _ in range(99)))
                    finally:
                        release.set()
                responses.append(first.result())

            accepted = [response.json() for response in responses if response.status_code == 200]
            assert accepted
            assert all(
                snapshot["observedAt"] == expected["observedAt"]
                and snapshot["services"] == expected["services"]
                for snapshot in accepted
            )
            assert {response.status_code for response in responses} <= {200, 503}
            assert all(upstream.calls == {"/actuator/health": 1} for upstream in upstreams.values())

    asyncio.run(scenario())


def test_gateway_is_ready_when_bootstrap_finds_a_down_service():
    async def scenario():
        async with gateway(down_service="relatorios") as (client, upstreams):
            health, ready, status = await asyncio.gather(
                client.get("/health"), client.get("/ready"), client.get("/api/v1/system/status"),
            )
            assert health.status_code == ready.status_code == status.status_code == 200
            assert ready.json() == {"service": "gateway", "status": "ready"}
            snapshot = status.json()
            assert snapshot["stale"] is False
            assert {row["service"]: row["status"] for row in snapshot["services"]} == {
                "catalogo": "up", "usuarios": "up", "circulacao": "up", "relatorios": "down",
            }
            assert all(upstream.calls == {"/actuator/health": 1} for upstream in upstreams.values())
            assert (await client.get(ping("circulacao"))).status_code == 200

    asyncio.run(scenario())


def test_real_http_limits_request_and_response_before_forwarding_partial_data():
    async def scenario():
        async with gateway() as (client, upstreams):
            upstream = upstreams["catalogo"]

            async def oversized_body():
                for _ in range(5):
                    yield b"x" * 16_384

            response = await client.request("GET", ping("catalogo"), content=oversized_body())
            problem(response, 413, "PAYLOAD_TOO_LARGE")
            assert upstream.calls["/api/v1/ping"] == 0

            async def fragmented(send):
                await send({"type": "http.response.start", "status": 200, "headers": []})
                for _ in range(17):
                    await send({"type": "http.response.body", "body": b"x" * 65_536, "more_body": True})
                await send({"type": "http.response.body", "body": b""})

            upstream.handler = fragmented
            problem(await client.get(ping("catalogo")), 502, "UPSTREAM_BAD_RESPONSE")
            upstream.handler = upstream.respond
            assert (await client.get(ping("catalogo"))).status_code == 200
            assert upstream.calls["/api/v1/ping"] == 2

    asyncio.run(scenario())


def test_real_http_redirect_is_not_followed_and_route_method_is_checked():
    async def scenario():
        async with gateway() as (client, upstreams):
            response = await client.post(ping("catalogo"))
            problem(response, 405, "METHOD_NOT_ALLOWED")
            assert "GET" in response.headers["allow"]
            problem(await client.get("/api/v1/catalogo/inexistente"), 404, "ROUTE_NOT_FOUND")
            assert upstreams["catalogo"].calls["/api/v1/ping"] == 0

            async def redirect(send):
                await Upstream.respond(send, status=302, headers=[(b"location", b"/api/v1/ping")])

            upstreams["catalogo"].handler = redirect
            problem(await client.get(ping("catalogo")), 502, "UPSTREAM_BAD_RESPONSE")
            assert upstreams["catalogo"].calls["/api/v1/ping"] == 1

    asyncio.run(scenario())


def test_real_http_deadline_bounds_a_continuous_upstream_response():
    async def scenario():
        async with gateway(deadline=0.35) as (client, upstreams):
            upstream = upstreams["catalogo"]

            async def trickle(send):
                await send({"type": "http.response.start", "status": 200, "headers": []})
                for _ in range(10):
                    await send({"type": "http.response.body", "body": b"x", "more_body": True})
                    await asyncio.sleep(0.07)
                await send({"type": "http.response.body", "body": b""})

            upstream.handler = trickle
            problem(await client.get(ping("catalogo")), 504, "UPSTREAM_TIMEOUT")
            upstream.handler = upstream.respond
            assert (await client.get(ping("catalogo"))).status_code == 200
            assert upstream.calls["/api/v1/ping"] == 2

    asyncio.run(scenario())


def test_real_tcp_disconnect_releases_an_inflight_slot():
    async def scenario():
        async with gateway(service_slots={"catalogo": 1}) as (client, upstreams):
            upstream = upstreams["catalogo"]
            entered = asyncio.Event()
            release = asyncio.Event()

            async def blocked(send):
                entered.set()
                await release.wait()
                await Upstream.respond(send)

            upstream.handler = blocked
            _, writer = await asyncio.open_connection(client.base_url.host, client.base_url.port)
            try:
                writer.write(b"GET /api/v1/catalogo/ping HTTP/1.1\r\nHost: gateway\r\n\r\n")
                await writer.drain()
                async with asyncio.timeout(1):
                    await entered.wait()
                problem(await client.get(ping("catalogo")), 503, "UPSTREAM_CAPACITY_EXHAUSTED")
                upstream.handler = upstream.respond
                writer.close()
                await writer.wait_closed()
                async with asyncio.timeout(0.7):
                    while True:
                        response = await client.get(ping("catalogo"))
                        if response.status_code == 200:
                            break
                        problem(response, 503, "UPSTREAM_CAPACITY_EXHAUSTED")
                        await asyncio.sleep(0.05)
                assert upstream.calls["/api/v1/ping"] == 2
            finally:
                writer.close()
                release.set()

    asyncio.run(scenario())


def test_real_slow_upload_expires_without_attempting_upstream():
    async def scenario():
        async with gateway(deadline=0.35) as (client, upstreams):
            reader, writer = await asyncio.open_connection(client.base_url.host, client.base_url.port)
            try:
                writer.write(
                    b"GET /api/v1/catalogo/ping HTTP/1.1\r\n"
                    b"Host: gateway\r\nContent-Length: 10\r\n\r\nx"
                )
                await writer.drain()
                async with asyncio.timeout(1):
                    assert (await reader.readline()).startswith(b"HTTP/1.1 408 ")
                    raw_headers = await reader.readuntil(b"\r\n\r\n")
                    headers = dict(line.split(b": ", 1) for line in raw_headers.strip().split(b"\r\n"))
                    body = await reader.readexactly(int(headers[b"content-length"]))
                assert json.loads(body)["code"] == "REQUEST_TIMEOUT"
                assert upstreams["catalogo"].calls["/api/v1/ping"] == 0
            finally:
                writer.close()
                await writer.wait_closed()

    asyncio.run(scenario())


def test_server_guard_can_reject_before_the_gateway_envelope():
    async def scenario():
        async with gateway(guard=4) as (client, upstreams):
            peers = []
            try:
                for _ in range(3):
                    reader, writer = await asyncio.open_connection(client.base_url.host, client.base_url.port)
                    peers.append(writer)
                    writer.write(b"GET /health HTTP/1.1\r\nHost: gateway\r\n\r\n")
                    await writer.drain()
                    async with asyncio.timeout(1):
                        assert (await reader.readline()).startswith(b"HTTP/1.1 200 ")
                        await reader.readuntil(b"\r\n\r\n")
                response = await client.get("/health")
                assert response.status_code == 503
                assert "x-request-id" not in response.headers
                assert all(upstream.calls == {"/actuator/health": 1} for upstream in upstreams.values())
            finally:
                for writer in peers:
                    writer.close()
                await asyncio.gather(*(writer.wait_closed() for writer in peers))

    asyncio.run(scenario())
