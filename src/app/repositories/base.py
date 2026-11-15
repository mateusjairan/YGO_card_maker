"""Contrato dos repositórios (Repository Pattern)."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.domain.models import Card, User


@runtime_checkable
class CardRepository(Protocol):
    """Abstração de persistência das cartas: a API não conhece SQL nem PostgREST."""

    def setup(self) -> None:
        """Cria estruturas necessárias (idempotente)."""
        ...

    def ping(self) -> bool:
        """Verifica se o backend de persistência responde."""
        ...

    def create(self, card: Card) -> Card: ...

    def get(self, card_id: str) -> Card | None: ...

    def get_by_slug(self, slug: str) -> Card | None: ...

    def list_by_user(self, user_id: str, limit: int, offset: int) -> list[Card]: ...

    def count_by_user(self, user_id: str) -> int: ...

    def list_public(self, limit: int, offset: int, query: str | None = None) -> list[Card]: ...

    def update(self, card: Card) -> Card: ...

    def delete(self, card_id: str, user_id: str) -> bool: ...

    def increment_views(self, card_id: str) -> None: ...

    def sync_uploads(self, user_id: str) -> User | None:
        """Recalcula a cota do duelista a partir das cartas com arte."""
        ...


@runtime_checkable
class UserRepository(Protocol):
    """Persistência dos duelistas e do contador de uploads."""

    def create_user(self, user: User) -> User: ...

    def get_user(self, user_id: str) -> User | None: ...

    def get_user_by_email(self, email: str) -> User | None: ...
