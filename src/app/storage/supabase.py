"""Armazenamento no Supabase Storage (bucket público de leitura)."""

from __future__ import annotations

import logging

from supabase import Client, create_client

from app.storage.base import StoredImage

logger = logging.getLogger(__name__)


class SupabaseImageStorage:
    """Envia a imagem para o bucket configurado e devolve a URL pública."""

    def __init__(self, url: str, service_role_key: str, bucket: str) -> None:
        if not url or not service_role_key:
            raise ValueError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios")
        self.client: Client = create_client(url, service_role_key)
        self.bucket = bucket

    def save(self, data: bytes, *, filename: str, content_type: str) -> StoredImage:
        bucket = self.client.storage.from_(self.bucket)
        bucket.upload(
            path=filename,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        return StoredImage(url=bucket.get_public_url(filename), path=filename)

    def delete(self, path: str) -> None:
        if not path:
            return
        try:
            self.client.storage.from_(self.bucket).remove([path])
        except Exception:  # pragma: no cover - best effort
            logger.warning("falha_ao_remover_imagem", extra={"path": path}, exc_info=True)
