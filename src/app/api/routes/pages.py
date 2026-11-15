"""Páginas renderizadas no servidor (compartilhamento com Open Graph)."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.domain.labels import ATTRIBUTE_SHORT
from app.domain.rules import level_display, serial_number, stats_display, type_line

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parents[2] / "templates"))


def absolute_url(base: str, maybe_relative: str | None) -> str | None:
    if not maybe_relative:
        return None
    return urljoin(base.rstrip("/") + "/", maybe_relative)


@router.get("/c/{slug}", response_class=HTMLResponse, include_in_schema=False)
def share_page(request: Request, slug: str) -> HTMLResponse:
    """Página pública da carta: HTML no servidor para preview em redes sociais."""
    settings = request.app.state.settings
    card = request.app.state.cards.get_public(slug)

    attribute = ATTRIBUTE_SHORT.get(card.attribute) if card.attribute else None
    context = {
        "request": request,
        "card": card,
        "type_line": type_line(card),
        "serial": serial_number(card.id),
        "level": level_display(card),
        "stats": stats_display(card),
        "attribute": attribute,
        "kind": card.kind.value,
        "share_url": f"{settings.public_base_url.rstrip('/')}/c/{card.slug}",
        "frontend_url": settings.frontend_base_url.rstrip("/"),
        "og_image": absolute_url(settings.public_base_url, card.image_url),
        "description": (card.description or "Carta customizada criada no YGO Card Maker")[:180],
    }
    return templates.TemplateResponse(request=request, name="share.html", context=context)
