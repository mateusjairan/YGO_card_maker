"""Serviço de autenticação por e-mail (cadastro, login e sessão)."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from app.config import Settings
from app.core.errors import ConflictError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.domain.models import User
from app.repositories.base import UserRepository

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, repository: UserRepository, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    def register(self, email: str, password: str) -> tuple[User, str]:
        normalized = self.normalize_email(email)
        if self.repository.get_user_by_email(normalized) is not None:
            raise ConflictError("Este e-mail já está cadastrado")

        user = User(
            id=str(uuid.uuid4()),
            email=normalized,
            password_hash=hash_password(password),
            uploads_used=0,
            created_at=datetime.now(UTC),
        )
        self.repository.create_user(user)
        logger.info("usuario_cadastrado", extra={"user_id": user.id})
        return user, self.issue_token(user)

    def login(self, email: str, password: str) -> tuple[User, str]:
        user = self.repository.get_user_by_email(self.normalize_email(email))
        if user is None or not verify_password(password, user.password_hash):
            raise UnauthorizedError("E-mail ou senha incorretos")
        logger.info("usuario_autenticado", extra={"user_id": user.id})
        return user, self.issue_token(user)

    def get_user(self, user_id: str) -> User:
        user = self.repository.get_user(user_id)
        if user is None:
            raise UnauthorizedError("Sessão inválida")
        return user

    def issue_token(self, user: User) -> str:
        return create_access_token(
            user.id, self.settings.secret_key, self.settings.access_token_ttl_minutes
        )

    @property
    def uploads_limit(self) -> int:
        return self.settings.max_uploads_per_user
