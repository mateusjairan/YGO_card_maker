"""Configura o Supabase: valida chaves, aplica migrations e escreve o .env.

Uso:
    # com a chave secreta (service_role / sb_secret_...)
    python scripts/setup-supabase.py --url https://xxxx.supabase.co --service-key sb_secret_...

    # só com um Personal Access Token: busca a secret key e aplica as migrations
    python scripts/setup-supabase.py --url https://xxxx.supabase.co --access-token sbp_...

    # apenas diagnosticar (não altera o .env)
    python scripts/setup-supabase.py --url ... --service-key ... --check-only

O que ele faz:
  1. valida a URL e a chave (avisa se for publishable/anon);
  2. confere tabelas `users`/`cards` e o bucket `card-images`;
  3. aplica as migrations pelo Management API (com --access-token);
  4. escreve o .env com STORAGE_BACKEND=supabase.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
MANAGEMENT = "https://api.supabase.com/v1"


def request(
    url: str, *, method: str = "GET", headers: dict | None = None, body: bytes | None = None
):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", "replace")
    except Exception as error:  # noqa: BLE001 - rede/DNS
        return 0, str(error)


def jwt_role(token: str) -> str | None:
    """Lê o `role` do JWT sem validar assinatura (só para avisar o usuário)."""
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("role")
    except Exception:  # noqa: BLE001
        return None


def fetch_secret_key(project_ref: str, access_token: str) -> str | None:
    """Busca a chave secreta do projeto pelo Management API."""
    status, body = request(
        f"{MANAGEMENT}/projects/{project_ref}/api-keys?reveal=true",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if status != 200:
        print(f"[!] não consegui listar as chaves (HTTP {status}): {body[:140]}")
        return None

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None

    items = data if isinstance(data, list) else data.get("keys", [])
    for item in items:
        value = item.get("api_key") or item.get("key") or ""
        if value.startswith("sb_secret_") or jwt_role(value) == "service_role":
            return value
    return None


def apply_migrations(project_ref: str, access_token: str) -> bool:
    print("aplicando migrations…")
    for migration in MIGRATIONS:
        status, body = request(
            f"{MANAGEMENT}/projects/{project_ref}/database/query",
            method="POST",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            body=json.dumps({"query": migration.read_text(encoding="utf-8")}).encode(),
        )
        if status in (200, 201):
            print(f"  {migration.name}: aplicada")
        else:
            print(f"  {migration.name}: FALHOU (HTTP {status}) {body[:200]}")
            return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Configura o Supabase do YGO Card Maker")
    parser.add_argument("--url", required=True, help="Project URL (https://xxxx.supabase.co)")
    parser.add_argument("--service-key", help="service_role / sb_secret_...")
    parser.add_argument("--access-token", help="Personal Access Token (sbp_...)")
    parser.add_argument("--bucket", default="card-images")
    parser.add_argument("--check-only", action="store_true", help="não altera o .env")
    args = parser.parse_args()

    url = args.url.rstrip("/")
    if not re.match(r"^https://[a-z0-9-]+\.supabase\.(co|in)$", url):
        print(f"[!] URL estranha: {url} (esperado https://xxxx.supabase.co)")
        return 2

    project_ref = url.split("//", 1)[1].split(".", 1)[0]
    print(f"projeto: {project_ref}")

    service_key = args.service_key
    if not service_key and args.access_token:
        print("buscando a chave secreta pelo Management API…")
        service_key = fetch_secret_key(project_ref, args.access_token)
        if service_key:
            print(f"chave secreta encontrada ({service_key[:12]}…)")
        else:
            print("[!] não achei a secret key; use --service-key (Project Settings > API keys).")
            return 2

    if not service_key:
        print("[!] informe --service-key (só a leitura pode usar a publishable).")
        return 2

    role = jwt_role(service_key)
    publishable = service_key.startswith("sb_publishable_") or role == "anon"
    if publishable and not args.check_only:
        print("[!] essa é a chave PÚBLICA (publishable/anon), não a secreta.")
        print("    o backend escreve com a service_role/secret, que bypassa o RLS.")
        print("    Dashboard > Project Settings > API keys > Secret keys (sb_secret_...).")
        return 2
    if role and role != "service_role":
        print(f"[!] a chave tem role '{role}', não 'service_role'.")
        return 2
    if role == "service_role":
        print("chave: service_role (ok)")

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }

    # 1) tabelas
    tables = {}
    for table in ("users", "cards"):
        status, body = request(f"{url}/rest/v1/{table}?select=id&limit=1", headers=headers)
        tables[table] = status == 200
        print(f"tabela {table}: {'ok' if status == 200 else f'ausente (HTTP {status})'}")

    # 2) bucket
    status, _ = request(f"{url}/storage/v1/bucket/{args.bucket}", headers=headers)
    bucket_ok = status == 200
    print(f"bucket {args.bucket}: {'ok' if bucket_ok else f'ausente (HTTP {status})'}")

    # 3) migrations
    schema_ok = all(tables.values()) and bucket_ok
    if not schema_ok:
        if args.access_token:
            if not apply_migrations(project_ref, args.access_token):
                return 3
            tables = {table: True for table in tables}
            schema_ok = True
        else:
            print("\n[!] schema incompleto (tabelas/bucket). Aplique as migrations:")
            print("    supabase link --project-ref " + project_ref + " && supabase db push")
            print("    ou cole no SQL Editor, nesta ordem:")
            for migration in MIGRATIONS:
                print(f"      - {migration.relative_to(ROOT)}")
            print("    ou repita com --access-token sbp_... para aplicar automaticamente.")
            print("    as chaves serão gravadas no .env, mas STORAGE_BACKEND continua sqlite.")
            if args.check_only:
                return 3

    # 4) .env
    if not args.check_only:
        env_path = ROOT / ".env"
        if not env_path.exists():
            print("[!] .env não existe; gere a partir do .env.example primeiro.")
            return 4
        text = env_path.read_text(encoding="utf-8")
        replacements = {
            "STORAGE_BACKEND": "supabase" if schema_ok else "sqlite",
            "SUPABASE_URL": url,
            "SUPABASE_SERVICE_ROLE_KEY": service_key,
            "SUPABASE_BUCKET": args.bucket,
        }
        for key, value in replacements.items():
            pattern = re.compile(rf"^{key}=.*$", re.MULTILINE)
            text = (
                pattern.sub(f"{key}={value}", text)
                if pattern.search(text)
                else text + f"\n{key}={value}"
            )
        env_path.write_text(text, encoding="utf-8")
        backend = "supabase" if schema_ok else "sqlite (schema pendente)"
        print(f"\n.env atualizado: STORAGE_BACKEND={backend}")

    print("\npróximos passos:")
    print("  1. reinicie a API (uvicorn) para carregar o .env")
    print("  2. curl http://127.0.0.1:8000/health  -> database: true")
    print(f"  3. cadastre-se e suba uma arte; ela deve aparecer no bucket {args.bucket}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
