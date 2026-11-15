"""Contrato do repositório de cartas (Repository Pattern)."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.domain.models import Card


@runtime_checkable
class CardRepository(Protocol):
    """Abstração de persistência: a API não conhece SQL nem PostgREST.

    Isso permite trocar SQLite local por Postgres/Supabase sem tocar no
    serviço de domínio (ver docs/adr/0001-arquitetura.md).
    """

    def setup(self) -> None:
        """Cria estruturas necessárias (idempotente)."""
        ...

    def ping(self) -> bool:
        """Verifica se o backend de persistência responde."""
        ...

    def create(self, card: Card) -> Card: ...

    def get(self, card_id: str) -> Card | None: ...

    def get_by_slug(self, slug: str) -> Card | None: ...

    def list_by_owner(self, owner_hash: str, limit: int, offset: int) -> list[Card]: ...

    def count_by_owner(self, owner_hash: str) -> int: ...

    def list_public(self, limit: int, offset: int, query: str | None = None) -> list[Card]: ...

    def update(self, card: Card) -> Card: ...

    def delete(self, card_id: str, owner_hash: str) -> bool: ...

    def increment_views(self, card_id: str) -> None: ...
