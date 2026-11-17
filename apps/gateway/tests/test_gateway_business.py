import json

import httpx
from fastapi.testclient import TestClient

from inko_gateway.config import BUSINESS_ROUTES, GatewaySettings
from inko_gateway.main import create_app

from test_gateway_http import problem


def make_client(responses=None):
    seen = []

    def transport(service, plane, policy):
        def upstream(request):
            if plane != "business":
                return httpx.Response(200, json={"status": "UP"})
            seen.append((service, request.method, request.url.path, request.url.query.decode(), request.content,
                         request.headers.get("content-type")))
            status, payload = (responses or {}).get((request.method, request.url.path), (200, {"ok": True}))
            return httpx.Response(status, json=payload)

        return httpx.MockTransport(upstream)

    app = create_app(GatewaySettings(), transport_factory=transport)
    return TestClient(app), seen


def test_business_routes_map_to_fixed_services_and_paths():
    expected = {
        "/api/v1/livros": "catalogo",
        "/api/v1/livros/INK-0001": "catalogo",
        "/api/v1/livros/INK-0001/disponibilidade": "circulacao",
        "/api/v1/usuarios": "usuarios",
        "/api/v1/usuarios/USR-0142": "usuarios",
        "/api/v1/emprestimos": "circulacao",
        "/api/v1/emprestimos/ativos": "circulacao",
        "/api/v1/emprestimos/atrasados": "circulacao",
        "/api/v1/emprestimos/EMP-10302": "circulacao",
        "/api/v1/relatorios/multas": "relatorios",
        "/api/v1/relatorios/estatisticas": "relatorios",
    }
    client, seen = make_client()
    with client:
        for path in expected:
            assert client.get(path).status_code == 200, path
    assert [(path, service) for service, _, path, *_ in seen] == list(expected.items())


def test_json_body_is_forwarded_once_and_upstream_status_is_preserved():
    body = {"id": "INK-0100", "titulo": "Teste", "autor": "Autor", "categoria": "HQ"}
    conflict = {"type": "about:blank", "status": 409, "code": "DUPLICATE_ID"}
    client, seen = make_client({
        ("POST", "/api/v1/livros"): (201, body),
        ("POST", "/api/v1/emprestimos"): (409, conflict),
        ("POST", "/api/v1/emprestimos/EMP-10302/devolucao"): (200, {"id": "EMP-10302"}),
    })
    with client:
        created = client.post("/api/v1/livros", json=body)
        assert created.status_code == 201
        assert created.json() == body
        refused = client.post("/api/v1/emprestimos", json={"livroId": "INK-0001", "usuarioId": "USR-0142"})
        assert refused.status_code == 409
        assert refused.json()["code"] == "DUPLICATE_ID"
        assert client.post("/api/v1/emprestimos/EMP-10302/devolucao").status_code == 200
    assert [(service, method, path) for service, method, path, *_ in seen] == [
        ("catalogo", "POST", "/api/v1/livros"),
        ("circulacao", "POST", "/api/v1/emprestimos"),
        ("circulacao", "POST", "/api/v1/emprestimos/EMP-10302/devolucao"),
    ]
    assert json.loads(seen[0][4]) == body
    assert seen[0][5] == "application/json"
    assert seen[2][4] == b""


def test_query_parameters_are_allowlisted_per_route():
    client, seen = make_client()
    with client:
        assert client.get("/api/v1/livros", params={"categoria": "Mangá", "q": "maré"}).status_code == 200
        assert client.get("/api/v1/relatorios/multas?referenceDate=2026-11-09").status_code == 200
        problem(client.get("/api/v1/livros?destino=http://evil"), 400, "INVALID_QUERY")
        problem(client.get("/api/v1/livros?q=a&q=b"), 400, "INVALID_QUERY")
        problem(client.get("/api/v1/livros/INK-0001?q=a"), 400, "INVALID_REQUEST")
        problem(client.get("/api/v1/livros?q"), 400, "INVALID_QUERY")
    assert len(seen) == 2
    assert dict(item.split("=") for item in seen[1][3].split("&")) == {"referenceDate": "2026-11-09"}
    assert "categoria=Mang%C3%A1" in seen[0][3]


def test_methods_bodies_and_identifiers_are_validated_before_upstream():
    client, seen = make_client()
    with client:
        response = client.delete("/api/v1/livros")
        problem(response, 405, "METHOD_NOT_ALLOWED")
        assert response.headers["allow"] == "GET, POST"
        problem(client.put("/api/v1/emprestimos/EMP-1/devolucao"), 405, "METHOD_NOT_ALLOWED")
        problem(client.post("/api/v1/livros", content=b"titulo=x", headers={"content-type": "text/plain"}),
                415, "UNSUPPORTED_MEDIA_TYPE")
        problem(client.request("GET", "/api/v1/livros", content=b"{}"), 400, "BODY_NOT_ALLOWED")
        problem(client.post("/api/v1/livros", content=b"x" * 70_000, headers={"content-type": "application/json"}),
                413, "PAYLOAD_TOO_LARGE")
        problem(client.get("/api/v1/livros/INK_0001!"), 404, "ROUTE_NOT_FOUND")
        problem(client.get("/api/v1/livros/" + "A" * 33), 404, "ROUTE_NOT_FOUND")
        problem(client.get("/api/v1/emprestimos/EMP-1/extra"), 404, "ROUTE_NOT_FOUND")
    assert seen == []


def test_metrics_use_route_templates_not_identifiers():
    client, _ = make_client()
    with client:
        for index in range(5):
            assert client.get(f"/api/v1/emprestimos/EMP-{index}").status_code == 200
        metrics = client.get("/metrics").text
    assert 'route_id="emprestimos_get"' in metrics
    assert "EMP-3" not in metrics


def test_business_registry_preserves_capacity_and_control_routes():
    settings = GatewaySettings()
    assert {service.name: service.slots for service in settings.services} == {
        "catalogo": 12, "usuarios": 12, "circulacao": 8, "relatorios": 6,
    }
    assert settings.business_slots == 38
    assert settings.deadline == 2.0
    assert {route.service for route in BUSINESS_ROUTES} == {"catalogo", "usuarios", "circulacao", "relatorios"}
    assert all(not route.path.startswith(("/health", "/ready", "/metrics")) for route in BUSINESS_ROUTES)
    assert all(route.methods in (("GET",), ("POST",)) for route in BUSINESS_ROUTES)
