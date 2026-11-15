"""Repositório SQLite — usado no desenvolvimento local e nos testes.

O Postgres/Supabase é o alvo de produção; o SQLite existe para que o projeto
suba com um comando e sem credenciais externas (docker compose up).
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from app.domain.models import Card, User

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    uploads_used  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
    id            TEXT PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    monster_kind  TEXT,
    spell_kind    TEXT,
    trap_kind     TEXT,
    attribute     TEXT,
    race          TEXT,
    archetype     TEXT,
    level         INTEGER,
    atk           INTEGER,
    defense       INTEGER,
    image_url     TEXT,
    image_path    TEXT,
    rarity        TEXT NOT NULL DEFAULT 'secret',
    is_public     INTEGER NOT NULL DEFAULT 1,
    views         INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_user   ON cards (user_id);
CREATE INDEX IF NOT EXISTS idx_cards_public ON cards (is_public, created_at DESC);
"""

_UPDATABLE = (
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
    "updated_at",
)


class SQLiteRepository:
    """Cartas e duelistas sobre um arquivo SQLite."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    # --- infraestrutura -----------------------------------------------------
    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        try:
            # WAL é persistente no arquivo: configurado uma vez em setup(), não a
            # cada conexão (era overhead por requisição).
            connection.execute("PRAGMA busy_timeout=5000")
            yield connection
            connection.commit()
        finally:
            connection.close()

    def setup(self) -> None:
        with self._connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.executescript(_SCHEMA)

    def ping(self) -> bool:
        try:
            with self._connect() as connection:
                connection.execute("SELECT 1").fetchone()
            return True
        except sqlite3.Error:  # pragma: no cover - falha de I/O
            return False

    # --- usuários -----------------------------------------------------------
    def create_user(self, user: User) -> User:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO users (id, email, password_hash, uploads_used, created_at) "
                "VALUES (:id, :email, :password_hash, :uploads_used, :created_at)",
                user.to_row(),
            )
        return user

    def get_user(self, user_id: str) -> User | None:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return User.from_row(dict(row)) if row else None

    def get_user_by_email(self, email: str) -> User | None:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return User.from_row(dict(row)) if row else None

    def increment_uploads(self, user_id: str) -> User | None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE users SET uploads_used = uploads_used + 1 WHERE id = ?", (user_id,)
            )
        return self.get_user(user_id)

    # --- cartas -------------------------------------------------------------
    def get(self, card_id: str) -> Card | None:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        return Card.from_row(dict(row)) if row else None

    def get_by_slug(self, slug: str) -> Card | None:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM cards WHERE slug = ?", (slug,)).fetchone()
        return Card.from_row(dict(row)) if row else None

    def list_by_user(self, user_id: str, limit: int, offset: int) -> list[Card]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (user_id, limit, offset),
            ).fetchall()
        return [Card.from_row(dict(row)) for row in rows]

    def count_by_user(self, user_id: str) -> int:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS total FROM cards WHERE user_id = ?", (user_id,)
            ).fetchone()
        return int(row["total"]) if row else 0

    def list_public(self, limit: int, offset: int, query: str | None = None) -> list[Card]:
        sql = "SELECT * FROM cards WHERE is_public = 1"
        params: list[object] = []
        if query:
            sql += " AND (LOWER(name) LIKE ? OR LOWER(COALESCE(archetype, '')) LIKE ?)"
            like = f"%{query.lower()}%"
            params.extend([like, like])
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self._connect() as connection:
            rows = connection.execute(sql, params).fetchall()
        return [Card.from_row(dict(row)) for row in rows]

    def create(self, card: Card) -> Card:
        row = card.to_row()
        columns = ", ".join(row.keys())
        placeholders = ", ".join(f":{key}" for key in row)
        with self._connect() as connection:
            connection.execute(f"INSERT INTO cards ({columns}) VALUES ({placeholders})", row)
        return card

    def update(self, card: Card) -> Card:
        row = card.to_row()
        assignments = ", ".join(f"{column} = :{column}" for column in _UPDATABLE)
        with self._connect() as connection:
            connection.execute(
                f"UPDATE cards SET {assignments} WHERE id = :id AND user_id = :user_id", row
            )
        return card

    def delete(self, card_id: str, user_id: str) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM cards WHERE id = ? AND user_id = ?", (card_id, user_id)
            )
        return cursor.rowcount > 0

    def increment_views(self, card_id: str) -> None:
        with self._connect() as connection:
            connection.execute("UPDATE cards SET views = views + 1 WHERE id = ?", (card_id,))
