"""Contratos de entrada e saída da API (Pydantic v2)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.domain.models import Attribute, Card, CardKind, MonsterKind, Rarity, SpellKind, TrapKind
from app.domain.rules import (
    MAX_ARCHETYPE,
    MAX_DESCRIPTION,
    MAX_LINK_RATING,
    MAX_MONSTER_LEVEL,
    MAX_NAME,
    MAX_RACE,
    MAX_STAT,
    MAX_XYZ_RANK,
)


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class CardWrite(BaseModel):
    """Payload de criação/edição de uma carta."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1, max_length=MAX_NAME, examples=["Mago Negro"])
    kind: CardKind
    description: str = Field(default="", max_length=MAX_DESCRIPTION)

    monster_kind: MonsterKind | None = None
    spell_kind: SpellKind | None = None
    trap_kind: TrapKind | None = None
    attribute: Attribute | None = None
    race: str | None = Field(default=None, max_length=MAX_RACE, examples=["Dragão"])
    archetype: str | None = Field(default=None, max_length=MAX_ARCHETYPE)

    level: int | None = Field(default=None, ge=1, le=MAX_XYZ_RANK)
    atk: int | None = Field(default=None, ge=0, le=MAX_STAT)
    defense: int | None = Field(default=None, ge=0, le=MAX_STAT)

    image_url: str | None = Field(default=None, max_length=500)
    image_path: str | None = Field(default=None, max_length=300)
    rarity: Rarity = Rarity.SECRET
    is_public: bool = True

    @model_validator(mode="after")
    def _apply_kind_rules(self) -> CardWrite:
        self.race = _clean_optional(self.race)
        self.archetype = _clean_optional(self.archetype)

        if self.kind is CardKind.MONSTER:
            self.spell_kind = None
            self.trap_kind = None
            if self.monster_kind is None:
                raise ValueError("Escolha o tipo do monstro (normal, efeito, fusão...)")
            if self.attribute is None:
                raise ValueError("Monstros precisam de um atributo")
            if self.level is None:
                raise ValueError("Monstros precisam de nível/rank")

            if self.monster_kind is MonsterKind.LINK:
                if self.level > MAX_LINK_RATING:
                    raise ValueError(f"Link Rating deve ser no máximo {MAX_LINK_RATING}")
                if self.defense is not None:
                    raise ValueError("Monstros de Link não possuem DEF")
            elif self.monster_kind is MonsterKind.XYZ:
                if self.level > MAX_XYZ_RANK:
                    raise ValueError(f"Rank deve ser no máximo {MAX_XYZ_RANK}")
            elif self.level > MAX_MONSTER_LEVEL:
                raise ValueError(f"Nível deve ser no máximo {MAX_MONSTER_LEVEL}")

        elif self.kind is CardKind.SPELL:
            self.monster_kind = None
            self.trap_kind = None
            self.attribute = None
            self.race = None
            self.level = None
            self.atk = None
            self.defense = None
            if self.spell_kind is None:
                raise ValueError("Escolha o tipo da magia (normal, contínua, equipamento...)")

        else:  # TRAP
            self.monster_kind = None
            self.spell_kind = None
            self.attribute = None
            self.race = None
            self.level = None
            self.atk = None
            self.defense = None
            if self.trap_kind is None:
                raise ValueError("Escolha o tipo da armadilha (normal, contínua, contra)")

        if self.image_url and not self.image_url.startswith(("http://", "https://", "/")):
            raise ValueError("image_url deve ser uma URL http(s) ou caminho iniciado por /")

        return self


class CardPatch(BaseModel):
    """Atualização parcial: envia apenas o que mudou."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=MAX_NAME)
    kind: CardKind | None = None
    description: str | None = Field(default=None, max_length=MAX_DESCRIPTION)
    monster_kind: MonsterKind | None = None
    spell_kind: SpellKind | None = None
    trap_kind: TrapKind | None = None
    attribute: Attribute | None = None
    race: str | None = Field(default=None, max_length=MAX_RACE)
    archetype: str | None = Field(default=None, max_length=MAX_ARCHETYPE)
    level: int | None = Field(default=None, ge=1, le=MAX_XYZ_RANK)
    atk: int | None = Field(default=None, ge=0, le=MAX_STAT)
    defense: int | None = Field(default=None, ge=0, le=MAX_STAT)
    image_url: str | None = Field(default=None, max_length=500)
    image_path: str | None = Field(default=None, max_length=300)
    rarity: Rarity | None = None
    is_public: bool | None = None


class CardRead(BaseModel):
    """Representação pública de uma carta."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    name: str
    kind: CardKind
    description: str
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
    rarity: Rarity
    is_public: bool
    views: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_card(cls, card: Card) -> CardRead:
        return cls.model_validate(card)


class CardList(BaseModel):
    items: list[CardRead]
    limit: int
    offset: int


class UploadResult(BaseModel):
    url: str
    path: str
    width: int
    height: int
    content_type: Literal["image/webp"] = "image/webp"
    uploads_used: int = 0
    uploads_limit: int = 0


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8, max_length=128, description="Mínimo de 8 caracteres")


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    id: str
    email: str
    uploads_used: int
    uploads_limit: int
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserRead


class HealthStatus(BaseModel):
    status: Literal["ok", "degraded"]
    app: str
    env: str
    storage: str
    version: str
    checks: dict[str, Any] = Field(default_factory=dict)
