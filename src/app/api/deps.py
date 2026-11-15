"""Dependências compartilhadas das rotas (sessão, serviços)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings
from app.core.errors import UnauthorizedError
from app.core.security import decode_access_token
from app.domain.models import User
from app.services.auth import AuthService
from app.services.cards import CardService
from app.services.uploads import UploadService

bearer_scheme = HTTPBearer(auto_error=False, description="Token JWT retornado por /api/auth/login")


def settings_dep() -> Settings:
    return get_settings()


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.auth


def get_card_service(request: Request) -> CardService:
    return request.app.state.cards


def get_upload_service(request: Request) -> UploadService:
    return request.app.state.uploads


def current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    """Resolve o duelista a partir do `Authorization: Bearer <jwt>`."""
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Faça login para continuar")

    settings: Settings = request.app.state.settings
    user_id = decode_access_token(credentials.credentials, settings.secret_key)
    if user_id is None:
        raise UnauthorizedError("Sessão expirada. Entre novamente.")

    return request.app.state.auth.get_user(user_id)
