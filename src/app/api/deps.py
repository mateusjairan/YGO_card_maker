"""Dependências compartilhadas das rotas."""

from __future__ import annotations

from typing import Annotated

from fastapi import Header, Request

from app.config import Settings, get_settings
from app.core.errors import UnauthorizedError
from app.services.cards import CardService
from app.services.uploads import UploadService

MIN_OWNER_KEY_LENGTH = 16
MAX_OWNER_KEY_LENGTH = 128


def settings_dep() -> Settings:
    return get_settings()


def owner_key(
    x_owner_key: Annotated[str | None, Header(alias="X-Owner-Key")] = None,
) -> str:
    """Identidade anônima do duelista, gerada no navegador e guardada localmente.

    Não é login: é uma chave aleatória que prova a posse da carta. O servidor
    persiste apenas o hash (sha256 + salt).
    """
    if not x_owner_key or not (
        MIN_OWNER_KEY_LENGTH <= len(x_owner_key.strip()) <= MAX_OWNER_KEY_LENGTH
    ):
        raise UnauthorizedError(
            f"Envie o cabeçalho X-Owner-Key com {MIN_OWNER_KEY_LENGTH} a "
            f"{MAX_OWNER_KEY_LENGTH} caracteres"
        )
    return x_owner_key.strip()


def get_card_service(request: Request) -> CardService:
    return request.app.state.cards


def get_upload_service(request: Request) -> UploadService:
    return request.app.state.uploads
