"""Fábrica do repositório: escolhe SQLite ou Supabase a partir da configuração."""

from __future__ import annotations

from app.config import Settings
from app.repositories.base import CardRepository
from app.repositories.sqlite import SQLiteCardRepository
from app.repositories.supabase import SupabaseCardRepository


def build_repository(settings: Settings) -> CardRepository:
    """Cria o repositório configurado e garante o schema local."""
    if settings.storage_backend.lower() == "supabase":
        repository: CardRepository = SupabaseCardRepository(
            settings.supabase_url, settings.supabase_service_role_key
        )
    else:
        repository = SQLiteCardRepository(settings.sqlite_path)

    repository.setup()
    return repository
