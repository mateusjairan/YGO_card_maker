"""Serviço de upload: valida, padroniza, grava e consome a cota do duelista."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.config import Settings
from app.core.errors import QuotaExceededError
from app.core.metrics import UPLOADS
from app.domain.models import User
from app.services.images import process_image
from app.storage.base import ImageStorage, StoredImage


@dataclass(frozen=True, slots=True)
class UploadOutcome:
    stored: StoredImage
    width: int
    height: int
    uploads_used: int


class UploadService:
    def __init__(self, storage: ImageStorage, settings: Settings) -> None:
        self.storage = storage
        self.settings = settings

    def store(self, raw: bytes, content_type: str, user: User) -> UploadOutcome:
        limit = self.settings.max_uploads_per_user
        if user.uploads_used >= limit:
            raise QuotaExceededError(f"Limite de {limit} artes por duelista atingido")

        webp, width, height = process_image(
            raw,
            content_type=content_type,
            max_bytes=self.settings.max_upload_mb * 1024 * 1024,
            output_px=self.settings.image_output_px,
        )
        filename = f"{uuid.uuid4().hex}.webp"
        stored = self.storage.save(webp, filename=filename, content_type="image/webp")

        UPLOADS.inc()
        # a cota só é consumida quando a arte entra numa carta salva
        return UploadOutcome(
            stored=stored,
            width=width,
            height=height,
            uploads_used=user.uploads_used,
        )
