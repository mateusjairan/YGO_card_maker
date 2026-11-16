"""Testes de health check e métricas Prometheus."""

from __future__ import annotations


def test_health_ok(client):
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"]["database"] is True
    assert body["version"]


def test_liveness_nao_depende_do_banco(client, monkeypatch):
    """O keep-alive precisa responder 200 mesmo com o banco fora."""
    monkeypatch.setattr(client.app.state.repository, "ping", lambda: False)

    response = client.get("/health/live")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["uptime_s"] >= 0
    # a readiness continua fiel ao estado do banco
    assert client.get("/health").status_code == 503


def test_metrics_expostas(client):
    client.post(
        "/api/cards",
        json={"name": "Métrica", "kind": "spell", "spell_kind": "normal"},
    )

    response = client.get("/metrics")

    assert response.status_code == 200
    text = response.text
    assert "http_requests_total" in text
    assert 'ygo_cards_created_total{kind="spell"}' in text


def test_raiz_lista_links(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


def test_openapi_disponivel(client):
    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert "/api/cards" in schema["paths"]
    assert "/api/uploads" in schema["paths"]
