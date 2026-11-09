import os
import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request, Response


SERVICES = {
    "catalogo": os.getenv("CATALOGO_URL", "http://localhost:8081"),
    "usuarios": os.getenv("USUARIOS_URL", "http://localhost:8082"),
    "circulacao": os.getenv("CIRCULACAO_URL", "http://localhost:8083"),
    "relatorios": os.getenv("RELATORIOS_URL", "http://localhost:8084"),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
        app.state.http_client = client
        yield


app = FastAPI(title="INKO API Gateway", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"service": "gateway", "status": "ok"}


@app.get("/api/v1/system/status")
async def services_status(request: Request):
    async def probe(name: str, url: str):
        try:
            response = await request.app.state.http_client.get(f"{url}/actuator/health")
            return {"service": name, "status": "up" if response.status_code == 200 else "down"}
        except httpx.RequestError:
            return {"service": name, "status": "down"}

    return {"services": await asyncio.gather(*(probe(name, url) for name, url in SERVICES.items()))}


@app.api_route(
    "/api/v1/{service}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def proxy(service: str, path: str, request: Request):
    upstream = SERVICES.get(service)
    if upstream is None:
        raise HTTPException(status_code=404, detail="Serviço desconhecido")
    if path.startswith("actuator/") or ".." in path.split("/"):
        raise HTTPException(status_code=404, detail="Rota não disponível")
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() in {"accept", "content-type", "authorization", "x-request-id"}
    }
    try:
        response = await request.app.state.http_client.request(
            request.method,
            f"{upstream}/api/v1/{path}",
            params=request.query_params,
            content=await request.body(),
            headers=headers,
        )
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Serviço indisponível") from None
    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type", "application/json"),
    )
