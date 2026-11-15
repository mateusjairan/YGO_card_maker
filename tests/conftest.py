"""Fixtures compartilhadas dos testes (app isolada com SQLite temporário)."""

from __future__ import annotations

import io
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app

OWNER_KEY = "owner-key-de-teste-1234567890"
OTHER_OWNER_KEY = "outro-dono-de-teste-0987654321"


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
        owner_key_salt="salt-de-teste",
        max_upload_mb=1,
        max_cards_per_owner=5,
    )


@pytest.fixture()
def app(settings: Settings):
    return create_app(settings)


@pytest.fixture()
def client(app) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        test_client.headers.update({"X-Owner-Key": OWNER_KEY})
        yield test_client


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
        "holo": True,
        "is_public": True,
    }


@pytest.fixture()
def spell_payload() -> dict:
    return {
        "name": "Café do Duelista",
        "kind": "spell",
        "description": "Compre 2 cartas. Você não pode dormir neste turno.",
        "spell_kind": "quick_play",
        "holo": False,
    }


def png_bytes(
    size: tuple[int, int] = (80, 80), color: tuple[int, int, int] = (200, 60, 60)
) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    return buffer.getvalue()
