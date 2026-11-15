"""Fábrica do armazenamento de imagens."""

from __future__ import annotations

from app.config import Settings
from app.storage.base import ImageStorage
from app.storage.local import LocalImageStorage
from app.storage.supabase import SupabaseImageStorage


def build_image_storage(settings: Settings) -> ImageStorage:
    if settings.use_supabase:
        return SupabaseImageStorage(
            settings.supabase_url,
            settings.supabase_service_role_key,
            settings.supabase_bucket,
        )
    return LocalImageStorage(settings.upload_dir, settings.media_url)
