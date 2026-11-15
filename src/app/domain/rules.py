"""Regras puras de domínio: slug, linha de tipo e número de série."""

from __future__ import annotations

import re
import secrets
import unicodedata

from app.domain.labels import (
    ATTRIBUTE_SHORT,
    MONSTER_KIND_LABELS,
    SPELL_KIND_LABELS,
    TRAP_KIND_LABELS,
)
from app.domain.models import Card, CardKind

MAX_NAME = 60
MAX_DESCRIPTION = 800
MAX_ARCHETYPE = 40
MAX_RACE = 32

MAX_MONSTER_LEVEL = 12
MAX_XYZ_RANK = 13
MAX_LINK_RATING = 8
MAX_STAT = 5000

_SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"


def slugify(value: str) -> str:
    """Converte um nome em slug ASCII (sem acentos, minúsculo, com hífens)."""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return ascii_value[:48] or "carta"


def build_slug(name: str) -> str:
    """Gera um slug único e legível: `nome-curto-abc123`."""
    suffix = "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(6))
    return f"{slugify(name)}-{suffix}"


def serial_number(card_id: str) -> str:
    """Código de coleção exibido no rodapé da carta (derivado do id)."""
    raw = card_id.replace("-", "").upper()
    return f"YGO-{raw[:4]}-{raw[4:8]}"


def type_line(card: Card) -> str:
    """Linha de tipo no formato clássico: `DRAGÃO / EFEITO / "ARQUÉTIPO"`."""
    if card.kind is CardKind.MONSTER:
        parts: list[str] = []
        if card.race:
            parts.append(card.race.strip().upper())
        if card.monster_kind:
            parts.append(MONSTER_KIND_LABELS[card.monster_kind].upper())
        if card.archetype:
            parts.append(f'"{card.archetype.strip().upper()}"')
        return " / ".join(parts) or "MONSTRO"

    if card.kind is CardKind.SPELL:
        label = SPELL_KIND_LABELS.get(card.spell_kind) if card.spell_kind else None
        return f"MAGIA {label.upper()}" if label else "MAGIA"

    label = TRAP_KIND_LABELS.get(card.trap_kind) if card.trap_kind else None
    return f"ARMADILHA {label.upper()}" if label else "ARMADILHA"


def attribute_label(card: Card) -> str | None:
    if card.attribute is None:
        return None
    return ATTRIBUTE_SHORT[card.attribute]


def level_display(card: Card) -> dict[str, object]:
    """Dados da linha de nível/rank/link usados pelos templates."""
    if card.kind is not CardKind.MONSTER or not card.level:
        return {"visible": False, "rank": False, "link": False, "count": 0}

    if card.monster_kind is not None and card.monster_kind.value == "link":
        return {"visible": True, "rank": False, "link": True, "count": card.level}

    is_rank = card.monster_kind is not None and card.monster_kind.value == "xyz"
    return {"visible": True, "rank": is_rank, "link": False, "count": card.level}


def stats_display(card: Card) -> dict[str, str] | None:
    """ATK/DEF formatados; magias e armadilhas não têm estatísticas."""
    if card.kind is not CardKind.MONSTER:
        return None
    atk = "?" if card.atk is None else str(card.atk)
    if card.defense is None:
        return {"atk": atk}
    return {"atk": atk, "def": str(card.defense)}
