"""Testes unitários das regras de domínio (sem HTTP, sem banco)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domain.models import Attribute, Card, CardKind, MonsterKind
from app.domain.rules import (
    build_slug,
    level_display,
    serial_number,
    slugify,
    stats_display,
    type_line,
)
from app.domain.schemas import CardWrite


def make_card(**overrides) -> Card:
    data = {
        "id": "0f3d9a52-7c1e-4a6b-9a41-2c7e5b1d8f03",
        "slug": "aurora",
        "owner_hash": "hash",
        "name": "Aurora",
        "kind": CardKind.MONSTER,
        "monster_kind": MonsterKind.EFFECT,
        "attribute": Attribute.LIGHT,
        "race": "Fada",
        "level": 7,
        "atk": 2400,
        "defense": 1800,
    }
    data.update(overrides)
    return Card(**data)


class TestSlug:
    def test_remove_acentos_e_espacos(self):
        assert slugify("Julia, Dama de Köln") == "julia-dama-de-koln"

    def test_nome_sem_letras_usa_fallback(self):
        assert slugify("!!! ???") == "carta"

    def test_build_slug_tem_sufixo_aleatorio(self):
        first = build_slug("Dragão Branco")
        second = build_slug("Dragão Branco")
        assert first.startswith("dragao-branco-")
        assert len(first.rsplit("-", 1)[1]) == 6
        assert first != second

    def test_serial_number_derivado_do_id(self):
        assert serial_number("0f3d9a52-7c1e-4a6b-9a41-2c7e5b1d8f03") == "YGO-0F3D-9A52"


class TestTypeLine:
    def test_monstro_completo(self):
        card = make_card(archetype="Guardiões de Köln")
        assert type_line(card) == 'FADA / EFEITO / "GUARDIÕES DE KÖLN"'

    def test_monstro_sem_raca(self):
        assert type_line(make_card(race=None)) == "EFEITO"

    def test_monstro_sem_tipo(self):
        assert type_line(make_card(monster_kind=None)) == "FADA"

    def test_magia(self):
        card = make_card(kind=CardKind.SPELL, spell_kind=None, monster_kind=None, attribute=None)
        card.spell_kind = None
        assert type_line(card) == "MAGIA"

    def test_magia_rapida(self):
        card = make_card(kind=CardKind.SPELL, monster_kind=None, attribute=None)
        from app.domain.models import SpellKind

        card.spell_kind = SpellKind.QUICK_PLAY
        assert type_line(card) == "MAGIA RÁPIDA"

    def test_armadilha(self):
        from app.domain.models import TrapKind

        card = make_card(
            kind=CardKind.TRAP, monster_kind=None, attribute=None, trap_kind=TrapKind.COUNTER
        )
        assert type_line(card) == "ARMADILHA CONTRA"


class TestLevelAndStats:
    def test_nivel_normal(self):
        info = level_display(make_card(level=8))
        assert info == {"visible": True, "rank": False, "link": False, "count": 8}

    def test_xyz_usa_rank(self):
        info = level_display(make_card(monster_kind=MonsterKind.XYZ, level=4))
        assert info["rank"] is True
        assert info["count"] == 4

    def test_link_usa_badge(self):
        info = level_display(make_card(monster_kind=MonsterKind.LINK, level=3, defense=None))
        assert info["link"] is True
        assert info["count"] == 3

    def test_magia_nao_tem_nivel(self):
        card = make_card(kind=CardKind.SPELL, monster_kind=None, level=None)
        assert level_display(card)["visible"] is False

    def test_stats_monstro(self):
        assert stats_display(make_card()) == {"atk": "2400", "def": "1800"}

    def test_link_sem_def(self):
        assert stats_display(make_card(monster_kind=MonsterKind.LINK, defense=None)) == {
            "atk": "2400"
        }

    def test_magia_sem_stats(self):
        assert stats_display(make_card(kind=CardKind.SPELL)) is None


class TestCardWriteValidation:
    def test_magia_limpa_campos_de_monstro(self):
        payload = CardWrite(
            name="Café",
            kind=CardKind.SPELL,
            spell_kind="quick_play",
            attribute=Attribute.FIRE,
            atk=100,
            level=4,
        )
        assert payload.attribute is None
        assert payload.atk is None
        assert payload.level is None

    def test_armadilha_limpa_tipo_de_magia(self):
        payload = CardWrite(
            name="Buraco", kind=CardKind.TRAP, trap_kind="normal", spell_kind="field"
        )
        assert payload.spell_kind is None
        assert payload.trap_kind is not None

    def test_monstro_exige_atributo(self):
        with pytest.raises(ValidationError, match="atributo"):
            CardWrite(name="X", kind=CardKind.MONSTER, monster_kind="effect", level=4)

    def test_monstro_exige_nivel(self):
        with pytest.raises(ValidationError, match="nível"):
            CardWrite(name="X", kind=CardKind.MONSTER, monster_kind="effect", attribute="dark")

    def test_link_nao_aceita_def(self):
        with pytest.raises(ValidationError, match="DEF"):
            CardWrite(
                name="X",
                kind=CardKind.MONSTER,
                monster_kind="link",
                attribute="dark",
                level=2,
                defense=100,
            )

    def test_link_tem_limite_de_rating(self):
        with pytest.raises(ValidationError, match="Link Rating"):
            CardWrite(
                name="X",
                kind=CardKind.MONSTER,
                monster_kind="link",
                attribute="dark",
                level=9,
            )

    def test_xyz_permite_rank_13(self):
        payload = CardWrite(
            name="X", kind=CardKind.MONSTER, monster_kind="xyz", attribute="dark", level=13
        )
        assert payload.level == 13

    def test_nivel_acima_de_12_falha(self):
        with pytest.raises(ValidationError, match="Nível"):
            CardWrite(
                name="X", kind=CardKind.MONSTER, monster_kind="effect", attribute="dark", level=13
            )

    def test_magia_exige_subtipo(self):
        with pytest.raises(ValidationError, match="magia"):
            CardWrite(name="X", kind=CardKind.SPELL)

    def test_url_de_imagem_invalida(self):
        with pytest.raises(ValidationError, match="image_url"):
            CardWrite(
                name="X",
                kind=CardKind.SPELL,
                spell_kind="normal",
                image_url="javascript:alert(1)",
            )

    def test_campos_opcionais_em_branco_viram_none(self):
        payload = CardWrite(
            name="X", kind=CardKind.SPELL, spell_kind="normal", archetype="  ", race=" "
        )
        assert payload.archetype is None
        assert payload.race is None

    def test_nome_obrigatorio(self):
        with pytest.raises(ValidationError):
            CardWrite(name="", kind=CardKind.SPELL, spell_kind="normal")


class TestCardModel:
    def test_roundtrip_para_linha(self):
        card = make_card()
        row = card.to_row()
        assert row["kind"] == "monster"
        assert row["attribute"] == "light"
        assert isinstance(row["created_at"], str)

        restored = Card.from_row(row)
        assert restored.name == card.name
        assert restored.monster_kind is MonsterKind.EFFECT
        assert restored.created_at == card.created_at

    def test_from_row_com_datetime_e_valores_padrao(self):
        from datetime import UTC, datetime

        now = datetime.now(UTC)
        restored = Card.from_row(
            {
                "id": "abc",
                "slug": "abc",
                "owner_hash": "h",
                "name": "Sem extras",
                "kind": "spell",
                "created_at": now,
                "updated_at": now,
            }
        )
        assert restored.description == ""
        assert restored.views == 0
        assert restored.holo is True
        assert restored.created_at == now
