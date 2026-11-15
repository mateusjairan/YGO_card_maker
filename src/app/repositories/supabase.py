"""Repositório Supabase (PostgREST) — backend de produção.

A service_role key fica apenas no servidor: o navegador nunca fala direto com
o banco. As tabelas e políticas estão em supabase/migrations.
"""

from __future__ import annotations

from typing import Any

from supabase import Client, create_client

from app.domain.models import Card

UPDATABLE_COLUMNS = (
    "name",
    "kind",
    "description",
    "monster_kind",
    "spell_kind",
    "trap_kind",
    "attribute",
    "race",
    "archetype",
    "level",
    "atk",
    "defense",
    "image_url",
    "image_path",
    "holo",
    "is_public",
    "updated_at",
)


def _rows(response: Any) -> list[dict[str, Any]]:
    data = getattr(response, "data", None)
    return data if isinstance(data, list) else []


def _row(response: Any) -> dict[str, Any] | None:
    data = getattr(response, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data or None


class SupabaseCardRepository:
    """Implementação sobre a tabela `public.cards` do Supabase."""

    def __init__(self, url: str, service_role_key: str) -> None:
        if not url or not service_role_key:
            raise ValueError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios")
        self.client: Client = create_client(url, service_role_key)

    def setup(self) -> None:
        """No Supabase o schema é versionado em supabase/migrations."""
        return None

    def ping(self) -> bool:
        try:
            self.client.table("cards").select("id").limit(1).execute()
            return True
        except Exception:  # pragma: no cover - depende de rede
            return False

    def get(self, card_id: str) -> Card | None:
        response = self.client.table("cards").select("*").eq("id", card_id).maybe_single().execute()
        row = _row(response)
        return Card.from_row(row) if row else None

    def get_by_slug(self, slug: str) -> Card | None:
        response = self.client.table("cards").select("*").eq("slug", slug).maybe_single().execute()
        row = _row(response)
        return Card.from_row(row) if row else None

    def list_by_owner(self, owner_hash: str, limit: int, offset: int) -> list[Card]:
        response = (
            self.client.table("cards")
            .select("*")
            .eq("owner_hash", owner_hash)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return [Card.from_row(row) for row in _rows(response)]

    def count_by_owner(self, owner_hash: str) -> int:
        response = (
            self.client.table("cards")
            .select("id", count="exact")
            .eq("owner_hash", owner_hash)
            .execute()
        )
        count = getattr(response, "count", None)
        return int(count) if count is not None else len(_rows(response))

    def list_public(self, limit: int, offset: int, query: str | None = None) -> list[Card]:
        builder = self.client.table("cards").select("*").eq("is_public", True)
        if query:
            pattern = query.replace(",", " ")
            builder = builder.or_(f"name.ilike.%{pattern}%,archetype.ilike.%{pattern}%")
        response = (
            builder.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        )
        return [Card.from_row(row) for row in _rows(response)]

    def create(self, card: Card) -> Card:
        self.client.table("cards").insert(card.to_row()).execute()
        return card

    def update(self, card: Card) -> Card:
        row = card.to_row()
        payload = {column: row[column] for column in UPDATABLE_COLUMNS}
        (
            self.client.table("cards")
            .update(payload)
            .eq("id", card.id)
            .eq("owner_hash", card.owner_hash)
            .execute()
        )
        return card

    def delete(self, card_id: str, owner_hash: str) -> bool:
        response = (
            self.client.table("cards")
            .delete()
            .eq("id", card_id)
            .eq("owner_hash", owner_hash)
            .execute()
        )
        return bool(_rows(response))

    def increment_views(self, card_id: str) -> None:
        self.client.rpc("increment_card_views", {"p_card_id": card_id}).execute()
