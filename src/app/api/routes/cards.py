"""Rotas REST de cartas."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import current_user, get_card_service
from app.core.metrics import CARD_CREATE_LATENCY
from app.domain.models import User
from app.domain.schemas import CardList, CardPatch, CardRead, CardWrite
from app.services.cards import CardService

router = APIRouter(prefix="/api/cards", tags=["cards"])

ServiceDep = Annotated[CardService, Depends(get_card_service)]
UserDep = Annotated[User, Depends(current_user)]


@router.post("", response_model=CardRead, status_code=status.HTTP_201_CREATED)
def create_card(payload: CardWrite, service: ServiceDep, user: UserDep) -> CardRead:
    """Cria uma carta para o duelista autenticado."""
    with CARD_CREATE_LATENCY.time():
        card = service.create(payload, user.id)
    return CardRead.from_card(card)


@router.get("", response_model=CardList)
def list_public_cards(
    service: ServiceDep,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[str | None, Query(max_length=60)] = None,
) -> CardList:
    """Galeria pública (cartas marcadas como públicas)."""
    cards = service.list_public(limit, offset, q)
    return CardList(items=[CardRead.from_card(card) for card in cards], limit=limit, offset=offset)


@router.get("/mine", response_model=CardList)
def list_my_cards(
    service: ServiceDep,
    user: UserDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CardList:
    """Cartas do duelista autenticado."""
    cards = service.list_mine(user.id, limit, offset)
    return CardList(items=[CardRead.from_card(card) for card in cards], limit=limit, offset=offset)


@router.get("/slug/{slug}", response_model=CardRead)
def get_card_by_slug(slug: str, service: ServiceDep) -> CardRead:
    """Busca pela URL amigável (usada pela página de compartilhamento)."""
    return CardRead.from_card(service.get_public(slug, count_view=False))


@router.get("/{card_id}", response_model=CardRead)
def get_card(card_id: str, service: ServiceDep) -> CardRead:
    return CardRead.from_card(service.get(card_id))


@router.patch("/{card_id}", response_model=CardRead)
def update_card(card_id: str, payload: CardPatch, service: ServiceDep, user: UserDep) -> CardRead:
    """Atualiza a carta (apenas o dono)."""
    return CardRead.from_card(service.update(card_id, payload, user.id))


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(card_id: str, service: ServiceDep, user: UserDep) -> Response:
    """Remove a carta e a imagem associada (apenas o dono)."""
    service.delete(card_id, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
