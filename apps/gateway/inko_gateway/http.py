import asyncio
import re
from urllib.parse import parse_qsl, urlencode
from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse

from .config import RequestBudget


REQUEST_ID = re.compile(rb"[A-Za-z0-9._-]{1,64}")
METHODS = frozenset(("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE"))


class RequestProblem(Exception):
    def __init__(self, status, code, title, headers=None):
        self.status = status
        self.code = code
        self.title = title
        self.headers = headers

    def response(self, request_id):
        return JSONResponse(
            {
                "type": "about:blank", "title": self.title, "status": self.status,
                "code": self.code, "requestId": request_id,
                "detail": "O Gateway não conseguiu concluir esta operação.",
            },
            status_code=self.status, headers=self.headers, media_type="application/problem+json",
        )


class Disconnected(Exception):
    pass


def deadline_problem(phase, headers=None):
    if phase == "upstream":
        return RequestProblem(504, "UPSTREAM_TIMEOUT", "Serviço excedeu o prazo", headers)
    if phase == "send":
        return RequestProblem(503, "GATEWAY_SEND_TIMEOUT", "Gateway excedeu o prazo de envio", headers)
    return RequestProblem(408, "REQUEST_TIMEOUT", "Requisição excedeu o prazo", headers)


def validate_structure(scope):
    headers = scope["headers"]
    if len(headers) > 64 or sum(len(name) + len(value) + 4 for name, value in headers) > 16384:
        raise RequestProblem(431, "HEADERS_TOO_LARGE", "Cabeçalhos excedem o limite")
    decoded = scope["path"]
    raw = scope.get("raw_path") or decoded.encode()
    if len(raw) > 1024 or len(scope["query_string"]) > 4096:
        raise RequestProblem(414, "URI_TOO_LONG", "URI excede o limite")
    if raw != decoded.encode() or "//" in decoded or "\\" in decoded or any(
        segment in (".", "..") for segment in decoded.split("/")
    ):
        raise RequestProblem(400, "INVALID_REQUEST", "Caminho inválido")


async def read_body(scope, receive, maximum):
    headers = scope["headers"]
    encodings = [value.lower() for name, value in headers if name == b"content-encoding"]
    if encodings and encodings != [b"identity"]:
        raise RequestProblem(415, "UNSUPPORTED_MEDIA_TYPE", "Codificação de corpo inválida")

    lengths = [value for name, value in headers if name == b"content-length"]
    declared = None
    if lengths:
        if len(lengths) != 1 or not lengths[0].isdigit() or any(name == b"transfer-encoding" for name, _ in headers):
            raise RequestProblem(400, "INVALID_REQUEST", "Comprimento de corpo inválido")
        digits = lengths[0].lstrip(b"0") or b"0"
        if len(digits) > len(str(maximum)) or int(digits) > maximum:
            raise RequestProblem(413, "PAYLOAD_TOO_LARGE", "Corpo excede o limite")
        declared = int(digits)

    body = bytearray()
    while True:
        message = await receive()
        if message["type"] == "http.disconnect":
            raise Disconnected
        body.extend(message.get("body", b""))
        if len(body) > maximum:
            raise RequestProblem(413, "PAYLOAD_TOO_LARGE", "Corpo excede o limite")
        if not message.get("more_body", False):
            break
    if declared is not None and len(body) != declared:
        raise RequestProblem(400, "INVALID_REQUEST", "Comprimento de corpo divergente")
    return bytes(body)


async def read_ping_body(scope, receive, maximum, title="Ping exige corpo vazio"):
    if await read_body(scope, receive, maximum):
        raise RequestProblem(400, "BODY_NOT_ALLOWED", title)


async def read_json_body(scope, receive, maximum):
    body = await read_body(scope, receive, maximum)
    if not body:
        return body
    types = [value for name, value in scope["headers"] if name == b"content-type"]
    media = types[0].split(b";", 1)[0].strip().lower() if len(types) == 1 else b""
    if media != b"application/json":
        raise RequestProblem(415, "UNSUPPORTED_MEDIA_TYPE", "Corpo deve ser application/json")
    return body


def validate_query(policy, raw):
    if not raw:
        return b""
    if not policy.query:
        title = "Ping não aceita parâmetros de consulta" if policy.id.endswith("_ping") else "Rota não aceita parâmetros de consulta"
        raise RequestProblem(400, "INVALID_REQUEST", title)
    try:
        pairs = parse_qsl(
            raw.decode("ascii"), keep_blank_values=True, strict_parsing=True,
            max_num_fields=len(policy.query), separator="&",
        )
    except (UnicodeDecodeError, ValueError):
        raise RequestProblem(400, "INVALID_QUERY", "Parâmetros de consulta inválidos") from None
    names = [name for name, _ in pairs]
    if len(set(names)) != len(names) or not set(names) <= policy.query or any(
        len(value) > 120 or any(ord(char) < 32 for char in value) for _, value in pairs
    ):
        raise RequestProblem(400, "INVALID_QUERY", "Parâmetros de consulta inválidos")
    return urlencode(pairs).encode("ascii")


async def wait_for_disconnect(receive):
    while (await receive())["type"] != "http.disconnect":
        pass


async def serve_until_disconnect(app, scope, receive, send):
    request = asyncio.create_task(app(scope, receive, send))
    watch = asyncio.create_task(wait_for_disconnect(receive))
    try:
        await asyncio.wait((request, watch), return_when=asyncio.FIRST_COMPLETED)
        if request.done():
            await request
        else:
            await watch
            scope["state"]["client_disconnected"] = True
            raise Disconnected
    finally:
        for task in (request, watch):
            task.cancel()
        await asyncio.gather(request, watch, return_exceptions=True)


class GatewayHTTP:
    def __init__(self, app, routes):
        self.app = app
        self.routes = routes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        runtime = scope["app"].state.runtime
        settings = runtime.settings
        loop = asyncio.get_running_loop()
        start = loop.time()
        budget = RequestBudget(start + settings.deadline)
        cutoff = budget.deadline - settings.error_reserve
        metrics = runtime.metrics
        method = scope["method"]
        policy, allowed = self.routes.match(scope["path"], method)
        route_id = policy.id if policy else "unmatched"
        control = policy is not None and policy.service is None
        ids = [value for name, value in scope["headers"] if name == b"x-request-id"]
        request_id = ids[0].decode("ascii") if len(ids) == 1 and REQUEST_ID.fullmatch(ids[0]) else str(uuid4())
        state = scope.setdefault("state", {})
        state.update(
            gateway_id=request_id, budget=budget, work_cutoff=cutoff,
            phase="request", client_disconnected=False,
        )
        response_started = False
        response_completed = False
        status_class = "aborted"
        lease = None

        async def tracked_send(message):
            nonlocal response_started, response_completed, status_class
            if message["type"] == "http.response.start":
                response_started = True
                status_class = f"{message['status'] // 100}xx"
                MutableHeaders(scope=message)["x-request-id"] = request_id
            await send(message)
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                response_completed = True

        try:
            async with asyncio.timeout_at(budget.deadline):
                try:
                    async with asyncio.timeout_at(cutoff):
                        validate_structure(scope)
                        if not control:
                            peer = scope.get("client")
                            rejection = runtime.limiter.check(peer[0] if peer else None, runtime.clock())
                            metrics.client_buckets.set(len(runtime.limiter.clients))
                            if rejection:
                                key, wait = rejection
                                metrics.rate_rejections.labels(key).inc()
                                raise RequestProblem(429, "RATE_LIMITED", "Quota excedida", {"Retry-After": str(wait)})
                        if policy is None:
                            raise RequestProblem(404, "ROUTE_NOT_FOUND", "Rota indisponível")
                        if method not in policy.methods:
                            raise RequestProblem(
                                405, "METHOD_NOT_ALLOWED", "Método não permitido", {"Allow": ", ".join(allowed)},
                            )
                        if not control:
                            state["upstream_query"] = validate_query(policy, scope["query_string"])
                        lease = runtime.acquire(policy.service)
                        if control:
                            state["phase"] = "send"
                            await self.app(scope, receive, tracked_send)
                        else:
                            state["route"] = policy
                            if policy.body:
                                state["upstream_body"] = await read_json_body(scope, receive, settings.request_bytes)
                            else:
                                title = "Ping exige corpo vazio" if policy.upstream else "Rota não aceita corpo"
                                await read_ping_body(scope, receive, settings.request_bytes, title)
                                state["upstream_body"] = b""
                            await serve_until_disconnect(self.app, scope, receive, tracked_send)
                except TimeoutError:
                    if response_started:
                        raise
                    problem = deadline_problem(state["phase"])
                    await problem.response(request_id)(scope, receive, tracked_send)
                except RequestProblem as exc:
                    if response_started:
                        raise
                    if exc.status in (413, 415):
                        metrics.payload_rejections.labels("request", "size" if exc.status == 413 else "encoding").inc()
                    await exc.response(request_id)(scope, receive, tracked_send)
        except Disconnected:
            if response_started:
                raise
        except TimeoutError:
            if response_started:
                raise TimeoutError("Gateway response deadline exceeded") from None
            problem = deadline_problem(state["phase"], {"Connection": "close"})
            async with asyncio.timeout_at(budget.deadline):
                await problem.response(request_id)(scope, receive, tracked_send)
        finally:
            if lease is not None:
                lease()
            metrics.record_request(
                route_id, method if method in METHODS else "OTHER",
                status_class if response_completed else "aborted", start, loop.time(),
            )
