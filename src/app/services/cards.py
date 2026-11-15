"""Serviço de cartas: regras de negócio, posse e orquestração do repositório."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from pydantic import ValidationError

from app.config import Settings
from app.core.errors import (
    ForbiddenError,
    InvalidPayloadError,
    LimitExceededError,
    NotFoundError,
)
from app.core.metrics import CARD_VIEWS, CARDS_CREATED, CARDS_DELETED, CARDS_UPDATED
from app.domain.models import Card
from app.domain.rules import build_slug
from app.domain.schemas import CardPatch, CardWrite
from app.repositories.base import CardRepository
from app.storage.base import ImageStorage

logger = logging.getLogger(__name__)

_EDITABLE_FIELDS = (
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
    "rarity",
    "is_public",
)


class CardService:
    def __init__(
        self,
        repository: CardRepository,
        storage: ImageStorage,
        settings: Settings,
    ) -> None:
        self.repository = repository
        self.storage = storage
        self.settings = settings

    # --- consultas ----------------------------------------------------------
    def get(self, card_id: str) -> Card:
        card = self.repository.get(card_id)
        if card is None:
            raise NotFoundError("Carta não encontrada")
        return card

    def get_public(self, slug: str, *, count_view: bool = True) -> Card:
        card = self.repository.get_by_slug(slug)
        if card is None or not card.is_public:
            raise NotFoundError("Carta não encontrada")
        if count_view:
            self.repository.increment_views(card.id)
            CARD_VIEWS.inc()
            card.views += 1
        return card

    def list_mine(self, user_id: str, limit: int, offset: int) -> list[Card]:
        return self.repository.list_by_user(user_id, limit, offset)

    def list_public(self, limit: int, offset: int, query: str | None = None) -> list[Card]:
        return self.repository.list_public(limit, offset, query)

    # --- comandos -----------------------------------------------------------
    def create(self, payload: CardWrite, user_id: str) -> Card:
        if self.repository.count_by_user(user_id) >= self.settings.max_cards_per_owner:
            raise LimitExceededError(
                f"Limite de {self.settings.max_cards_per_owner} cartas por duelista atingido"
            )

        now = datetime.now(UTC)
        card = Card(
            id=str(uuid.uuid4()),
            slug=self._unique_slug(payload.name),
            user_id=user_id,
            created_at=now,
            updated_at=now,
            **payload.model_dump(),
        )
        created = self.repository.create(card)
        CARDS_CREATED.labels(kind=card.kind.value).inc()
        logger.info("carta_criada", extra={"card_id": card.id, "kind": card.kind.value})
        return created

    def update(self, card_id: str, payload: CardPatch, user_id: str) -> Card:
        card = self._owned(card_id, user_id)
        changes = payload.model_dump(exclude_unset=True)
        merged = {field: getattr(card, field) for field in _EDITABLE_FIELDS}

        # remove valores explicitamente nulos para não quebrar a validação de tipo
        merged.update({key: value for key, value in changes.items() if value is not None})

        try:
            validated = CardWrite(**merged)
        except ValidationError as exc:
            raise InvalidPayloadError(
                "Dados da carta inválidos",
                details=[
                    {"field": ".".join(str(part) for part in error["loc"]), "message": error["msg"]}
                    for error in exc.errors()
                ],
            ) from exc

        previous_image = card.image_path
        for field in _EDITABLE_FIELDS:
            setattr(card, field, getattr(validated, field))
        card.updated_at = datetime.now(UTC)

        updated = self.repository.update(card)
        CARDS_UPDATED.inc()

        if previous_image and previous_image != card.image_path:
            self.storage.delete(previous_image)

        logger.info("carta_atualizada", extra={"card_id": card.id})
        return updated

    def delete(self, card_id: str, user_id: str) -> None:
        card = self._owned(card_id, user_id)
        if not self.repository.delete(card.id, user_id):
            raise NotFoundError("Carta não encontrada")
        if card.image_path:
            self.storage.delete(card.image_path)
        CARDS_DELETED.inc()
        logger.info("carta_removida", extra={"card_id": card.id})

    # --- helpers ------------------------------------------------------------
    def _owned(self, card_id: str, user_id: str) -> Card:
        card = self.repository.get(card_id)
        if card is None:
            raise NotFoundError("Carta não encontrada")
        if card.user_id != user_id:
            raise ForbiddenError()
        return card

    def _unique_slug(self, name: str) -> str:
        for _ in range(6):
            candidate = build_slug(name)
            if self.repository.get_by_slug(candidate) is None:
                return candidate
        # fallback praticamente impossível de colidir
        return build_slug(f"{name}-{uuid.uuid4().hex[:8]}")
