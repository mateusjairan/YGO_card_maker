"""Testes de upload (padronização e cota) e da página pública."""

from __future__ import annotations

import io

from PIL import Image

from tests.conftest import png_bytes


def image_bytes(size: tuple[int, int], color: tuple[int, int, int] = (200, 60, 60)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    return buffer.getvalue()


class TestUpload:
    def test_upload_padroniza_para_quadrado_e_webp(self, client, settings):
        # 2400x1600 -> recorte central 1:1 + downscale para 256 (config de teste)
        response = client.post(
            "/api/uploads",
            files={"file": ("arte.png", image_bytes((2400, 1600)), "image/png")},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["url"].startswith("http://testserver/media/")
        assert body["path"].endswith(".webp")
        assert body["width"] == settings.image_output_px
        assert body["height"] == settings.image_output_px
        assert body["content_type"] == "image/webp"
        assert body["uploads_used"] == 1
        assert body["uploads_limit"] == settings.max_uploads_per_user

    def test_imagem_pequena_nao_sofre_upscale(self, client):
        response = client.post(
            "/api/uploads", files={"file": ("mini.png", png_bytes((80, 64)), "image/png")}
        )

        assert response.status_code == 201
        body = response.json()
        assert body["width"] == 64
        assert body["height"] == 64

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

    def test_upload_exige_login(self, anonymous_client):
        response = anonymous_client.post(
            "/api/uploads", files={"file": ("arte.png", png_bytes(), "image/png")}
        )

        assert response.status_code == 401


class TestQuota:
    def test_quinto_upload_esgota_a_cota(self, client, settings):
        for index in range(settings.max_uploads_per_user):
            response = client.post(
                "/api/uploads",
                files={"file": (f"arte{index}.png", png_bytes((120, 120)), "image/png")},
            )
            assert response.status_code == 201, response.text
            assert response.json()["uploads_used"] == index + 1

        sexto = client.post("/api/uploads", files={"file": ("sexto.png", png_bytes(), "image/png")})

        assert sexto.status_code == 403
        assert sexto.json()["code"] == "quota_exceeded"

    def test_cota_aparece_no_me(self, client):
        client.post("/api/uploads", files={"file": ("arte.png", png_bytes(), "image/png")})

        me = client.get("/api/auth/me").json()

        assert me["uploads_used"] == 1
        assert me["uploads_limit"] == 5

    def test_cota_e_por_duelista(self, client, other_client):
        client.post("/api/uploads", files={"file": ("arte.png", png_bytes(), "image/png")})

        assert other_client.get("/api/auth/me").json()["uploads_used"] == 0


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
