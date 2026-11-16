"""Remove contas/cartas de teste do banco local e imagens órfãs.

Uso: python scripts/cleanup-db.py [caminho-do-sqlite]
"""

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "cards.db"
UPLOAD_DIR = DB_PATH.parent / "uploads"

PREFIXES = ("audit-%", "ui-%", "browser-%", "intruso-%", "smoke-%", "e2e-%")

if not DB_PATH.exists():
    raise SystemExit(f"banco não encontrado: {DB_PATH}")

db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row

where = " OR ".join("email LIKE ?" for _ in PREFIXES)
users = db.execute(f"SELECT id, email FROM users WHERE {where}", list(PREFIXES)).fetchall()

deleted_cards = 0
for user in users:
    deleted_cards += db.execute(
        "SELECT COUNT(*) FROM cards WHERE user_id = ?", (user["id"],)
    ).fetchone()[0]
    db.execute("DELETE FROM cards WHERE user_id = ?", (user["id"],))
    db.execute("DELETE FROM users WHERE id = ?", (user["id"],))
db.commit()

used = {
    row[0]
    for row in db.execute(
        "SELECT image_path FROM cards WHERE image_path IS NOT NULL AND image_path <> ''"
    )
}
removed = 0
if UPLOAD_DIR.exists():
    for file in UPLOAD_DIR.glob("*.webp"):
        if file.name not in used:
            file.unlink()
            removed += 1

remaining_cards = db.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
remaining_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
db.close()

print(f"usuários de teste removidos: {len(users)}")
print(f"cartas removidas: {deleted_cards}")
print(f"imagens órfãs removidas: {removed}")
print(f"restante: {remaining_cards} carta(s), {remaining_users} usuário(s)")
