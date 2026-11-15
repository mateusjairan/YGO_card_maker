"""Armazenamento local em disco, servido pela própria API em /media."""

from __future__ import annotations

import logging
from pathlib import Path

from app.storage.base import StoredImage

logger = logging.getLogger(__name__)


class LocalImageStorage:
    """Salva as imagens em `upload_dir` e devolve a URL pública de /media."""

    def __init__(self, upload_dir: str | Path, media_base_url: str) -> None:
        self.base_dir = Path(upload_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.media_base_url = media_base_url.rstrip("/")

    def save(self, data: bytes, *, filename: str, content_type: str) -> StoredImage:
        target = self.base_dir / filename
        target.write_bytes(data)
        return StoredImage(url=f"{self.media_base_url}/{filename}", path=filename)

    def delete(self, path: str) -> None:
        if not path:
            return
        candidate = (self.base_dir / Path(path).name).resolve()
        if not str(candidate).startswith(str(self.base_dir.resolve())):
            logger.warning("upload_delete_fora_do_diretorio", extra={"path": path})
            return
        candidate.unlink(missing_ok=True)
