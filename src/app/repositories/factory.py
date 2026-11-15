"""Fábrica do repositório: escolhe SQLite ou Supabase a partir da configuração."""

from __future__ import annotations

from app.config import Settings
from app.repositories.sqlite import SQLiteRepository
from app.repositories.supabase import SupabaseRepository


def build_repository(settings: Settings) -> SQLiteRepository | SupabaseRepository:
    """Cria o repositório configurado e garante o schema local."""
    if settings.storage_backend.lower() == "supabase":
        repository = SupabaseRepository(settings.supabase_url, settings.supabase_service_role_key)
    else:
        repository = SQLiteRepository(settings.sqlite_path)

    repository.setup()
    return repository
