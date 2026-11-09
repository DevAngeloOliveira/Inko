from fastapi.testclient import TestClient

from inko_gateway.main import app


def test_gateway_health():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "gateway", "status": "ok"}


def test_unknown_service_is_rejected():
    with TestClient(app) as client:
        response = client.get("/api/v1/desconhecido/ping")
    assert response.status_code == 404
