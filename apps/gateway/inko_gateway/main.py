import asyncio
from contextlib import AsyncExitStack, asynccontextmanager, suppress

import httpx
from fastapi import FastAPI, Request
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.responses import JSONResponse, Response

from .config import GatewaySettings, RoutePolicy
from .http import GatewayHTTP, RequestProblem
from .resilience import CircuitBreaker, RateLimiter
from .telemetry import GatewayMetrics
from .upstream import UpstreamPayloadError, make_client, ping, refresh_snapshot, schedule_snapshots


class Runtime:
    def __init__(self, settings, clients, probes, clock):
        self.settings = settings
        self.clients = clients
        self.probes = probes
        self.clock = clock
        self.metrics = GatewayMetrics()
        self.limiter = RateLimiter(settings, clock())
        self.breakers = {service: CircuitBreaker(settings) for service in clients}
        self.service_slots = {service.name: service.slots for service in settings.services}
        self.by_service = dict.fromkeys(clients, 0)
        self.by_plane = {"business": 0, "control": 0}
        self.snapshot = None
        for service in clients:
            self.metrics.observe_breaker(service, "closed", "closed")
            for plane in ("business", "control"):
                self.metrics.attempts.labels(service, plane)
                self.metrics.upstream_inflight.labels(service, plane)
        for plane in self.by_plane:
            self.metrics.inflight.labels(plane)

    def acquire(self, service):
        plane = "control" if service is None else "business"
        maximum = self.settings.control_slots if service is None else self.settings.business_slots
        if self.by_plane[plane] >= maximum:
            self.metrics.admission_rejections.labels(service or "control", plane).inc()
            raise RequestProblem(503, "GATEWAY_OVERLOADED", "Gateway sem capacidade")
        if service is not None and self.by_service[service] >= self.service_slots[service]:
            self.metrics.admission_rejections.labels(service, "service").inc()
            raise RequestProblem(503, "UPSTREAM_CAPACITY_EXHAUSTED", "Serviço sem capacidade")
        self.by_plane[plane] += 1
        self.metrics.inflight.labels(plane).inc()
        if service is not None:
            self.by_service[service] += 1
            self.metrics.admitted.inc()
        active = True

        def release():
            nonlocal active
            if not active:
                return
            active = False
            self.by_plane[plane] -= 1
            self.metrics.inflight.labels(plane).dec()
            if service is not None:
                self.by_service[service] -= 1

        return release

    async def execute(self, request, service):
        clock = self.clock
        breaker = self.breakers[service]
        previous = breaker.state
        now = clock()
        permit = breaker.permit(now)
        self.metrics.observe_breaker(service, previous, breaker.state)
        if permit is None:
            retry = breaker.retry_after(now)
            headers = {"Retry-After": str(retry)} if retry is not None else None
            raise RequestProblem(503, "UPSTREAM_CIRCUIT_OPEN", "Circuito do serviço aberto", headers)

        def begin_attempt():
            request.state.phase = "upstream"
            request.state.budget.consume_attempt()
            self.metrics.attempts.labels(service, "business").inc()

        outcome = "neutral"
        with self.metrics.upstream_inflight.labels(service, "business").track_inprogress():
            try:
                response = await ping(
                    self.clients[service], request, self.settings, request.state.work_cutoff, begin_attempt,
                )
                if response.status_code >= 500:
                    outcome = "failure"
                elif response.status_code != 429:
                    outcome = "success"
                request.state.phase = "send"
                return response
            except httpx.PoolTimeout:
                self.metrics.pool_timeouts.labels(service, "business").inc()
                self.metrics.admission_rejections.labels(service, "pool").inc()
                raise RequestProblem(503, "UPSTREAM_CAPACITY_EXHAUSTED", "Serviço sem capacidade") from None
            except (TimeoutError, httpx.TimeoutException):
                if not request.state.budget.dispatched:
                    raise RequestProblem(408, "REQUEST_TIMEOUT", "Requisição excedeu o prazo") from None
                outcome = "failure"
                raise RequestProblem(504, "UPSTREAM_TIMEOUT", "Serviço excedeu o prazo") from None
            except asyncio.CancelledError:
                if (
                    request.state.budget.dispatched
                    and asyncio.get_running_loop().time() >= request.state.work_cutoff
                    and not request.state.client_disconnected
                ):
                    outcome = "failure"
                raise
            except (UpstreamPayloadError, httpx.HTTPError, httpx.InvalidURL) as exc:
                outcome = "failure"
                if isinstance(exc, UpstreamPayloadError):
                    self.metrics.payload_rejections.labels("response", exc.args[0]).inc()
                raise RequestProblem(502, "UPSTREAM_BAD_RESPONSE", "Resposta do serviço inválida") from None
            finally:
                previous = breaker.state
                breaker.finish(permit, outcome, clock())
                self.metrics.observe_breaker(service, previous, breaker.state)
                self.metrics.upstream_duration.labels(service, "business").observe(max(0.0, clock() - now))


def make_ping_endpoint(service):
    async def forward_ping(request: Request):
        return await request.app.state.runtime.execute(request, service)

    return forward_ping


def create_app(settings=None, *, clock=None, transport_factory=None):
    settings = settings if settings is not None else GatewaySettings.from_env()

    @asynccontextmanager
    async def lifespan(application):
        async with AsyncExitStack() as resources:
            clients = {
                policy.name: await resources.enter_async_context(make_client(policy, "business", transport_factory))
                for policy in settings.services
            }
            probes = {
                policy.name: await resources.enter_async_context(make_client(policy, "control", transport_factory))
                for policy in settings.services
            }
            runtime = Runtime(settings, clients, probes, clock or asyncio.get_running_loop().time)
            application.state.runtime = runtime
            started = await refresh_snapshot(runtime)
            scheduler = asyncio.create_task(schedule_snapshots(runtime, started))
            try:
                yield
            finally:
                scheduler.cancel()
                with suppress(asyncio.CancelledError):
                    await scheduler

    application = FastAPI(
        title="INKO API Gateway", version="0.1.0", lifespan=lifespan, redirect_slashes=False,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )

    @application.get("/health")
    async def health():
        return {"service": "gateway", "status": "ok"}

    @application.get("/ready")
    async def ready():
        return {"service": "gateway", "status": "ready"}

    @application.get("/api/v1/system/status")
    async def services_status(request: Request):
        runtime = request.app.state.runtime
        payload = runtime.snapshot.response(runtime.clock(), runtime.settings)
        return JSONResponse(payload, headers={"Cache-Control": "no-store"})

    @application.get("/metrics", include_in_schema=False)
    async def metrics(request: Request):
        runtime = request.app.state.runtime
        runtime.metrics.snapshot_age.set(max(0.0, runtime.clock() - runtime.snapshot.completed))
        return Response(generate_latest(runtime.metrics.registry), headers={"Content-Type": CONTENT_TYPE_LATEST})

    controls = {
        "/health": "health", "/ready": "ready",
        "/api/v1/system/status": "status", "/metrics": "metrics",
    }
    if settings.docs_enabled:
        controls.update({
            "/docs": "docs", "/docs/oauth2-redirect": "docs_redirect",
            "/redoc": "redoc", "/openapi.json": "openapi",
        })
    routes = {path: RoutePolicy(route_id, path) for path, route_id in controls.items()}
    for policy in settings.services:
        path = f"/api/v1/{policy.name}/ping"
        routes[path] = RoutePolicy(f"{policy.name}_ping", path, policy.name)
        application.add_api_route(path, make_ping_endpoint(policy.name), methods=["GET"], name=routes[path].id)
    application.add_middleware(GatewayHTTP, routes=routes)
    return application


app = create_app()
