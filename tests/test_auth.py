"""Testes de autenticação por e-mail, sessão e cota."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import EMAIL, PASSWORD


class TestRegister:
    def test_cadastro_devolve_token_e_usuario(self, anonymous_client):
        response = anonymous_client.post(
            "/api/auth/register", json={"email": "novo@exemplo.com", "password": "senha-forte-123"}
        )

        assert response.status_code == 201
        body = response.json()
        assert body["token_type"] == "bearer"
        assert body["access_token"]
        assert body["user"]["email"] == "novo@exemplo.com"
        assert body["user"]["uploads_used"] == 0
        assert body["user"]["uploads_limit"] == 5

    def test_email_normalizado_em_minusculas(self, anonymous_client):
        response = anonymous_client.post(
            "/api/auth/register",
            json={"email": "MAIUSCULO@Exemplo.com", "password": "senha-forte-123"},
        )

        assert response.status_code == 201
        assert response.json()["user"]["email"] == "maiusculo@exemplo.com"

    def test_email_duplicado_retorna_409(self, client):
        response = client.post(
            "/api/auth/register", json={"email": EMAIL, "password": "outra-senha-123"}
        )

        assert response.status_code == 409
        assert response.json()["code"] == "conflict"

    def test_senha_curta_retorna_422(self, anonymous_client):
        response = anonymous_client.post(
            "/api/auth/register", json={"email": "curta@exemplo.com", "password": "1234567"}
        )

        assert response.status_code == 422

    def test_email_invalido_retorna_422(self, anonymous_client):
        response = anonymous_client.post(
            "/api/auth/register", json={"email": "nao-e-email", "password": "senha-forte-123"}
        )

        assert response.status_code == 422


class TestLogin:
    def test_login_com_credenciais_corretas(self, anonymous_client, client):
        response = anonymous_client.post(
            "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}
        )

        assert response.status_code == 200
        assert response.json()["user"]["email"] == EMAIL

    def test_senha_errada_retorna_401(self, anonymous_client):
        response = anonymous_client.post(
            "/api/auth/login", json={"email": EMAIL, "password": "senha-errada-123"}
        )

        assert response.status_code == 401
        assert response.json()["code"] == "unauthorized"

    def test_email_inexistente_retorna_401(self, anonymous_client):
        response = anonymous_client.post(
            "/api/auth/login", json={"email": "ninguem@exemplo.com", "password": "qualquer-123"}
        )

        assert response.status_code == 401


class TestSession:
    def test_me_com_token(self, client):
        response = client.get("/api/auth/me")

        assert response.status_code == 200
        body = response.json()
        assert body["email"] == EMAIL
        assert body["uploads_used"] == 0

    def test_me_sem_token_retorna_401(self, anonymous_client):
        response = anonymous_client.get("/api/auth/me")

        assert response.status_code == 401
        assert response.json()["code"] == "unauthorized"

    def test_token_invalido_retorna_401(self, anonymous_client: TestClient):
        response = anonymous_client.get(
            "/api/auth/me", headers={"Authorization": "Bearer token-invalido"}
        )

        assert response.status_code == 401

    def test_cartas_exigem_login(self, anonymous_client, monster_payload):
        assert anonymous_client.get("/api/cards/mine").status_code == 401
        assert anonymous_client.post("/api/cards", json=monster_payload).status_code == 401
