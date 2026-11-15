"""Fixtures compartilhadas dos testes (app isolada, SQLite temporário, sessão)."""

from __future__ import annotations

import io
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app

EMAIL = "duelista@exemplo.com"
PASSWORD = "senha-super-segura"
OTHER_EMAIL = "rival@exemplo.com"


@pytest.fixture()
def settings(tmp_path) -> Settings:
    return Settings(
        app_env="test",
        log_level="WARNING",
        log_format="pretty",
        storage_backend="sqlite",
        sqlite_path=str(tmp_path / "cards.db"),
        upload_dir=str(tmp_path / "uploads"),
        public_base_url="http://testserver",
        frontend_base_url="http://web.test",
        secret_key="segredo-de-teste-com-mais-de-32-bytes-ok",
        max_upload_mb=1,
        max_cards_per_owner=12,
        max_uploads_per_user=5,
        image_output_px=256,
    )


@pytest.fixture()
def app(settings: Settings):
    return create_app(settings)


@pytest.fixture()
def client(app) -> Iterator[TestClient]:
    """Cliente já autenticado como `duelista@exemplo.com`."""
    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/auth/register", json={"email": EMAIL, "password": PASSWORD}
        )
        assert response.status_code == 201, response.text
        _authenticate(test_client, response.json())
        yield test_client


@pytest.fixture()
def other_client(app) -> Iterator[TestClient]:
    """Segundo duelista, para testar posse (403)."""
    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/auth/register", json={"email": OTHER_EMAIL, "password": PASSWORD}
        )
        _authenticate(test_client, response.json())
        yield test_client


@pytest.fixture()
def anonymous_client(app) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def _authenticate(client: TestClient, payload: dict) -> None:
    client.headers["Authorization"] = f"Bearer {payload['access_token']}"


@pytest.fixture()
def monster_payload() -> dict:
    return {
        "name": "Aurora, Sentinela do Véu",
        "kind": "monster",
        "description": "Quando esta carta é invocada, compre um café e respire fundo.",
        "monster_kind": "effect",
        "attribute": "light",
        "race": "Fada",
        "archetype": "Véu",
        "level": 7,
        "atk": 2400,
        "defense": 1800,
        "rarity": "secret",
        "is_public": True,
    }


@pytest.fixture()
def spell_payload() -> dict:
    return {
        "name": "Café do Duelista",
        "kind": "spell",
        "description": "Compre 2 cartas. Você não pode dormir neste turno.",
        "spell_kind": "quick_play",
        "rarity": "common",
    }


def png_bytes(
    size: tuple[int, int] = (80, 80), color: tuple[int, int, int] = (200, 60, 60)
) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    return buffer.getvalue()
