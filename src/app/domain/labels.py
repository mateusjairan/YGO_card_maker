"""Rótulos em pt-BR usados no texto da carta e na interface."""

from __future__ import annotations

from app.domain.models import Attribute, MonsterKind, SpellKind, TrapKind

MONSTER_KIND_LABELS: dict[MonsterKind, str] = {
    MonsterKind.NORMAL: "Normal",
    MonsterKind.EFFECT: "Efeito",
    MonsterKind.RITUAL: "Ritual",
    MonsterKind.FUSION: "Fusão",
    MonsterKind.SYNCHRO: "Sincro",
    MonsterKind.XYZ: "Xyz",
    MonsterKind.LINK: "Link",
    MonsterKind.PENDULUM: "Pêndulo",
    MonsterKind.TOKEN: "Ficha",
}

SPELL_KIND_LABELS: dict[SpellKind, str] = {
    SpellKind.NORMAL: "Normal",
    SpellKind.CONTINUOUS: "Contínua",
    SpellKind.EQUIP: "Equipamento",
    SpellKind.QUICK_PLAY: "Rápida",
    SpellKind.FIELD: "Campo",
    SpellKind.RITUAL: "Ritual",
}

TRAP_KIND_LABELS: dict[TrapKind, str] = {
    TrapKind.NORMAL: "Normal",
    TrapKind.CONTINUOUS: "Contínua",
    TrapKind.COUNTER: "Contra",
}

ATTRIBUTE_LABELS: dict[Attribute, str] = {
    Attribute.LIGHT: "Luz",
    Attribute.DARK: "Trevas",
    Attribute.EARTH: "Terra",
    Attribute.WATER: "Água",
    Attribute.FIRE: "Fogo",
    Attribute.WIND: "Vento",
    Attribute.DIVINE: "Divino",
}

ATTRIBUTE_SHORT: dict[Attribute, str] = {
    Attribute.LIGHT: "LIGHT",
    Attribute.DARK: "DARK",
    Attribute.EARTH: "EARTH",
    Attribute.WATER: "WATER",
    Attribute.FIRE: "FIRE",
    Attribute.WIND: "WIND",
    Attribute.DIVINE: "DIVINE",
}
