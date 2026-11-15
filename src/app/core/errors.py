"""Erros de domínio com tradução automática para respostas HTTP."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Erro de aplicação que vira uma resposta JSON padronizada."""

    status_code = 400
    code = "bad_request"
    message = "Requisição inválida"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: Any | None = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"detail": self.message, "code": self.code}
        if self.details is not None:
            payload["details"] = self.details
        return payload


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"
    message = "Não autenticado"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"
    message = "Você não tem permissão para alterar esta carta"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "Recurso não encontrado"


class InvalidPayloadError(AppError):
    status_code = 422
    code = "invalid_payload"
    message = "Dados da carta inválidos"


class UploadError(AppError):
    status_code = 422
    code = "invalid_upload"
    message = "Imagem inválida"


class LimitExceededError(AppError):
    status_code = 429
    code = "limit_exceeded"
    message = "Limite de cartas atingido"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    message = "Recurso já existe"


class QuotaExceededError(AppError):
    status_code = 403
    code = "quota_exceeded"
    message = "Você atingiu o limite de uploads"
