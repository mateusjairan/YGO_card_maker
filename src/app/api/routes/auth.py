"""Rotas de autenticação por e-mail."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import current_user, get_auth_service
from app.domain.models import User
from app.domain.schemas import AuthResponse, LoginRequest, RegisterRequest, UserRead
from app.services.auth import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

AuthDep = Annotated[AuthService, Depends(get_auth_service)]
UserDep = Annotated[User, Depends(current_user)]


def _user_read(user: User, service: AuthService) -> UserRead:
    return UserRead(
        id=user.id,
        email=user.email,
        uploads_used=user.uploads_used,
        uploads_limit=service.uploads_limit,
        created_at=user.created_at,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, service: AuthDep) -> AuthResponse:
    """Cria a conta e já devolve o token de sessão."""
    user, token = service.register(str(payload.email), payload.password)
    return AuthResponse(access_token=token, user=_user_read(user, service))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, service: AuthDep) -> AuthResponse:
    """Autentica por e-mail e senha."""
    user, token = service.login(str(payload.email), payload.password)
    return AuthResponse(access_token=token, user=_user_read(user, service))


@router.get("/me", response_model=UserRead)
def me(user: UserDep, service: AuthDep) -> UserRead:
    """Dados da sessão atual, incluindo a cota de uploads."""
    return _user_read(user, service)
