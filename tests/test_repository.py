"""Testes do repositório SQLite (integração com banco real em arquivo)."""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime

import pytest

from app.domain.models import Attribute, Card, CardKind, MonsterKind
from app.repositories.sqlite import SQLiteCardRepository


def make_card(**overrides) -> Card:
    now = datetime.now(UTC)
    data = {
        "id": "11111111-1111-1111-1111-111111111111",
        "slug": "carta-teste-abc123",
        "owner_hash": "hash-dono",
        "name": "Carta Teste",
        "kind": CardKind.MONSTER,
        "monster_kind": MonsterKind.EFFECT,
        "attribute": Attribute.DARK,
        "level": 4,
        "atk": 1500,
        "defense": 1200,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return Card(**data)


@pytest.fixture()
def repository(tmp_path) -> SQLiteCardRepository:
    repo = SQLiteCardRepository(tmp_path / "repo.db")
    repo.setup()
    return repo


def test_setup_e_idempotente(repository):
    repository.setup()
    assert repository.ping() is True


def test_cria_e_busca(repository):
    card = repository.create(make_card())

    assert repository.get(card.id).name == "Carta Teste"
    assert repository.get_by_slug(card.slug).id == card.id
    assert repository.get("inexistente") is None


def test_slug_unico(repository):
    repository.create(make_card())

    with pytest.raises(sqlite3.IntegrityError):
        repository.create(
            make_card(id="22222222-2222-2222-2222-222222222222", slug="carta-teste-abc123")
        )


def test_lista_por_dono_e_conta(repository):
    repository.create(make_card())
    repository.create(
        make_card(id="33333333-3333-3333-3333-333333333333", slug="outra-abc123", name="Outra")
    )

    assert len(repository.list_by_owner("hash-dono", limit=10, offset=0)) == 2
    assert repository.count_by_owner("hash-dono") == 2
    assert repository.list_by_owner("outro-hash", limit=10, offset=0) == []


def test_lista_publica_respeita_visibilidade_e_busca(repository):
    repository.create(make_card(name="Dragão Branco", slug="dragao-branco-aaa111"))
    repository.create(
        make_card(
            id="44444444-4444-4444-4444-444444444444",
            slug="carta-privada-bbb222",
            name="Segredo",
            is_public=False,
        )
    )

    publicas = repository.list_public(limit=10, offset=0)
    assert [card.name for card in publicas] == ["Dragão Branco"]

    filtradas = repository.list_public(limit=10, offset=0, query="dragão")
    assert len(filtradas) == 1


def test_atualiza_carta(repository):
    card = repository.create(make_card())
    card.name = "Nome Novo"
    card.level = 8

    repository.update(card)

    atualizada = repository.get(card.id)
    assert atualizada.name == "Nome Novo"
    assert atualizada.level == 8


def test_remove_apenas_do_dono(repository):
    card = repository.create(make_card())

    assert repository.delete(card.id, "outro-hash") is False
    assert repository.get(card.id) is not None

    assert repository.delete(card.id, "hash-dono") is True
    assert repository.get(card.id) is None


def test_incrementa_views(repository):
    card = repository.create(make_card())

    repository.increment_views(card.id)
    repository.increment_views(card.id)

    assert repository.get(card.id).views == 2
