"""Testes de upload de arte e da página pública de compartilhamento."""

from __future__ import annotations

from tests.conftest import png_bytes


class TestUpload:
    def test_upload_converte_para_webp(self, client):
        response = client.post(
            "/api/uploads",
            files={"file": ("arte.png", png_bytes(), "image/png")},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["url"].startswith("http://testserver/media/")
        assert body["path"].endswith(".webp")
        assert body["width"] == 80
        assert body["height"] == 80
        assert body["content_type"] == "image/webp"

    def test_arquivo_servido_em_media(self, client):
        body = client.post(
            "/api/uploads", files={"file": ("arte.png", png_bytes(), "image/png")}
        ).json()

        response = client.get(f"/media/{body['path']}")

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/webp"

    def test_formato_nao_suportado_retorna_422(self, client):
        response = client.post(
            "/api/uploads", files={"file": ("nota.txt", b"texto qualquer", "text/plain")}
        )

        assert response.status_code == 422
        assert response.json()["code"] == "invalid_upload"

    def test_arquivo_corrompido_retorna_422(self, client):
        response = client.post(
            "/api/uploads", files={"file": ("falsa.png", b"nao sou imagem", "image/png")}
        )

        assert response.status_code == 422

    def test_arquivo_grande_retorna_422(self, client, settings):
        oversized = b"0" * (settings.max_upload_mb * 1024 * 1024 + 10)
        response = client.post(
            "/api/uploads", files={"file": ("grande.png", oversized, "image/png")}
        )

        assert response.status_code == 422
        assert "MB" in response.json()["detail"]


class TestSharePage:
    def test_pagina_publica_renderiza_carta(self, client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        response = client.get(f"/c/{created['slug']}")

        assert response.status_code == 200
        html = response.text
        assert monster_payload["name"] in html
        assert 'property="og:title"' in html
        assert "FADA / EFEITO" in html
        assert "/static/card.css" in html

    def test_pagina_incrementa_views(self, client, monster_payload):
        created = client.post("/api/cards", json=monster_payload).json()

        client.get(f"/c/{created['slug']}")
        client.get(f"/c/{created['slug']}")

        card = client.get(f"/api/cards/{created['id']}").json()
        assert card["views"] == 2

    def test_carta_privada_nao_tem_pagina(self, client, monster_payload):
        created = client.post("/api/cards", json={**monster_payload, "is_public": False}).json()

        response = client.get(f"/c/{created['slug']}")

        assert response.status_code == 404

    def test_slug_inexistente_retorna_404(self, client):
        assert client.get("/c/nao-existe-abc123").status_code == 404
