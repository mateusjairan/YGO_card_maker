"""Auditoria da entrega: estrutura, README, CI, OpenAPI, migrations e segredos.

Uso: python scripts/audit.py
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


required = [
    "docker-compose.yml",
    "Dockerfile",
    "README.md",
    "CONTRIBUTORS.md",
    ".env.example",
    ".github/workflows/ci.yml",
    "docs/adr/0001-arquitetura-em-camadas.md",
    "docs/adr/0002-autenticacao.md",
    "docs/openapi.yaml",
    "docs/desempenho.md",
    "docs/ia.md",
    "load/k6-smoke.js",
    "tests/conftest.py",
    "supabase/migrations/20261115000000_init.sql",
    "supabase/migrations/20261115000100_storage.sql",
    "shared/card.css",
    "shared/fonts.css",
]
for path in required:
    check(f"existe {path}", (ROOT / path).exists())

first = read("README.md").splitlines()[0]
check("README declara Projeto B na 1ª linha", "Projeto B" in first, first)

readme = read("README.md")
for topic in ["## Como subir com um comando", "## Como testar", "docker compose up", "pytest"]:
    check(f"README tem '{topic}'", topic in readme)

openapi = read("docs/openapi.yaml")
for token in ["/api/auth/register", "/api/auth/login", "/api/cards", "/api/uploads", "rarity"]:
    check(f"OpenAPI contém {token}", token in openapi)

ci = read(".github/workflows/ci.yml")
for token in ["ruff check", "pytest", "coverage", "pnpm build", "docker compose build"]:
    check(f"CI executa {token}", token in ci)

pyproject = read("pyproject.toml")
check("cobertura mínima declarada (80)", "--cov-fail-under=80" in pyproject)

env = read(".env.example")
for token in [
    "SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "MAX_UPLOADS_PER_USER",
    "IMAGE_OUTPUT_PX",
]:
    check(f".env.example tem {token}", token in env)

ignore = read(".gitignore")
check(".gitignore ignora .env", ".env" in ignore)

tracked = subprocess.run(
    ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=False
).stdout.splitlines()
check("nenhum .env versionado", not any(p.endswith(".env") or "/.env" in p for p in tracked))
check(
    "nenhuma chave privada versionada",
    not [p for p in tracked if p.endswith((".pem", ".key"))],
)

compose = read("docker-compose.yml")
for token in ["api:", "web:", "healthcheck", "8080:80"]:
    check(f"compose tem {token}", token in compose)

k6 = read("load/k6-smoke.js")
check("k6 mede p95", "p(95)<300" in k6)

migration = read("supabase/migrations/20261115000000_init.sql")
for token in [
    "create table if not exists public.users",
    "create table if not exists public.cards",
    "increment_user_uploads",
    "enable row level security",
]:
    check(f"migration tem {token}", token in migration)

storage = read("supabase/migrations/20261115000100_storage.sql")
check("bucket card-images público", "card-images" in storage and "public" in storage)

bad = []
for base in ("src", "web/src", "scripts"):
    for path in (ROOT / base).rglob("*"):
        if path.suffix not in {".py", ".ts", ".tsx", ".mjs"}:
            continue
        if path.name == "audit.py":
            continue
        if re.search(r"\b(TODO|FIXME|XXX)\b", path.read_text(encoding="utf-8")):
            bad.append(str(path.relative_to(ROOT)))
check("sem TODO/FIXME no código", not bad, ",".join(bad))

failed = [item for item in results if not item[1]]
for name, ok, detail in results:
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))
print(f"\n{len(results) - len(failed)}/{len(results)} verificações passaram")
sys.exit(0 if not failed else 1)
