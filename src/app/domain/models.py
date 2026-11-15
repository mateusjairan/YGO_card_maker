"""Modelos de domínio da carta (independentes de framework e de banco)."""

from __future__ import annotations

import enum
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any


class CardKind(enum.StrEnum):
    MONSTER = "monster"
    SPELL = "spell"
    TRAP = "trap"


class MonsterKind(enum.StrEnum):
    NORMAL = "normal"
    EFFECT = "effect"
    RITUAL = "ritual"
    FUSION = "fusion"
    SYNCHRO = "synchro"
    XYZ = "xyz"
    LINK = "link"
    PENDULUM = "pendulum"
    TOKEN = "token"


class SpellKind(enum.StrEnum):
    NORMAL = "normal"
    CONTINUOUS = "continuous"
    EQUIP = "equip"
    QUICK_PLAY = "quick_play"
    FIELD = "field"
    RITUAL = "ritual"


class TrapKind(enum.StrEnum):
    NORMAL = "normal"
    CONTINUOUS = "continuous"
    COUNTER = "counter"


class Attribute(enum.StrEnum):
    LIGHT = "light"
    DARK = "dark"
    EARTH = "earth"
    WATER = "water"
    FIRE = "fire"
    WIND = "wind"
    DIVINE = "divine"


class Rarity(enum.StrEnum):
    """Acabamento da carta, na ordem em que o foil vai ficando mais elaborado."""

    COMMON = "common"
    RARE = "rare"
    SUPER = "super"
    ULTRA = "ultra"
    SECRET = "secret"
    PRISMATIC = "prismatic"
    ULTIMATE = "ultimate"
    GHOST = "ghost"
    STARLIGHT = "starlight"


@dataclass(slots=True)
class Card:
    """Entidade persistida de uma carta."""

    id: str
    slug: str
    user_id: str
    name: str
    kind: CardKind
    description: str = ""
    monster_kind: MonsterKind | None = None
    spell_kind: SpellKind | None = None
    trap_kind: TrapKind | None = None
    attribute: Attribute | None = None
    race: str | None = None
    archetype: str | None = None
    level: int | None = None
    atk: int | None = None
    defense: int | None = None
    image_url: str | None = None
    image_path: str | None = None
    rarity: Rarity = Rarity.SECRET
    is_public: bool = True
    views: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def to_row(self) -> dict[str, Any]:
        """Representação para persistência (colunas snake_case)."""
        row = asdict(self)
        row["kind"] = self.kind.value
        row["monster_kind"] = self.monster_kind.value if self.monster_kind else None
        row["spell_kind"] = self.spell_kind.value if self.spell_kind else None
        row["trap_kind"] = self.trap_kind.value if self.trap_kind else None
        row["attribute"] = self.attribute.value if self.attribute else None
        row["rarity"] = self.rarity.value
        row["created_at"] = self.created_at.isoformat()
        row["updated_at"] = self.updated_at.isoformat()
        return row

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> Card:
        """Reconstrói a entidade a partir de uma linha do banco."""
        return cls(
            id=row["id"],
            slug=row["slug"],
            user_id=row["user_id"],
            name=row["name"],
            kind=CardKind(row["kind"]),
            description=row.get("description") or "",
            monster_kind=MonsterKind(row["monster_kind"]) if row.get("monster_kind") else None,
            spell_kind=SpellKind(row["spell_kind"]) if row.get("spell_kind") else None,
            trap_kind=TrapKind(row["trap_kind"]) if row.get("trap_kind") else None,
            attribute=Attribute(row["attribute"]) if row.get("attribute") else None,
            race=row.get("race"),
            archetype=row.get("archetype"),
            level=row.get("level"),
            atk=row.get("atk"),
            defense=row.get("defense"),
            image_url=row.get("image_url"),
            image_path=row.get("image_path"),
            rarity=Rarity(row["rarity"]) if row.get("rarity") else Rarity.SECRET,
            is_public=bool(row.get("is_public", True)),
            views=int(row.get("views") or 0),
            created_at=_as_datetime(row.get("created_at")),
            updated_at=_as_datetime(row.get("updated_at")),
        )


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:  # pragma: no cover - defensivo
            pass
    return datetime.now(UTC)


@dataclass(slots=True)
class User:
    """Duelista autenticado por e-mail."""

    id: str
    email: str
    password_hash: str
    uploads_used: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def to_row(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "password_hash": self.password_hash,
            "uploads_used": self.uploads_used,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> User:
        return cls(
            id=row["id"],
            email=row["email"],
            password_hash=row["password_hash"],
            uploads_used=int(row.get("uploads_used") or 0),
            created_at=_as_datetime(row.get("created_at")),
        )
