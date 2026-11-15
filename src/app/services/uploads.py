"""Serviço de upload: valida, converte e grava a arte da carta."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.config import Settings
from app.core.metrics import UPLOADS
from app.services.images import process_image
from app.storage.base import ImageStorage, StoredImage


@dataclass(frozen=True, slots=True)
class UploadOutcome:
    stored: StoredImage
    width: int
    height: int


class UploadService:
    def __init__(self, storage: ImageStorage, settings: Settings) -> None:
        self.storage = storage
        self.settings = settings

    def store(self, raw: bytes, content_type: str) -> UploadOutcome:
        webp, width, height = process_image(
            raw,
            content_type=content_type,
            max_bytes=self.settings.max_upload_mb * 1024 * 1024,
        )
        filename = f"{uuid.uuid4().hex}.webp"
        stored = self.storage.save(webp, filename=filename, content_type="image/webp")
        UPLOADS.inc()
        return UploadOutcome(stored=stored, width=width, height=height)
