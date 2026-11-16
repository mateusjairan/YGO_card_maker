"""Configura o Supabase para o projeto: valida chaves, aplica migrations e escreve o .env.

Uso:
    python scripts/setup-supabase.py --url https://xxxx.supabase.co --service-key sb_secret_...

    # aplicar as migrations automaticamente (precisa de um Personal Access Token)
    python scripts/setup-supabase.py --url ... --service-key ... --access-token sbp_...

    # só validar, sem tocar no .env
    python scripts/setup-supabase.py --url ... --service-key ... --check-only

O que ele faz:
  1. valida a URL e a service_role (avisa se você colou a anon key);
  2. confere se as tabelas `users` e `cards` existem;
  3. confere o bucket `card-images`;
  4. com --access-token, roda as migrations pelo Management API;
  5. com --write (padrão), atualiza o .env para STORAGE_BACKEND=supabase.
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


def request(
    url: str, *, method: str = "GET", headers: dict | None = None, body: bytes | None = None
):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Configura o Supabase do YGO Card Maker")
    parser.add_argument("--url", required=True, help="Project URL (https://xxxx.supabase.co)")
    parser.add_argument("--service-key", required=True, help="service_role key")
    parser.add_argument("--bucket", default="card-images")
    parser.add_argument(
        "--access-token", help="Personal Access Token (sbp_...) para aplicar migrations"
    )
    parser.add_argument("--check-only", action="store_true", help="não altera o .env")
    parser.add_argument("--no-write", action="store_true", help="não altera o .env")
    args = parser.parse_args()

    url = args.url.rstrip("/")
    if not re.match(r"^https://[a-z0-9-]+\.supabase\.(co|in)$", url):
        print(f"[!] URL estranha: {url} (esperado https://xxxx.supabase.co)")
        return 2

    project_ref = url.split("//", 1)[1].split(".", 1)[0]
    headers = {
        "apikey": args.service_key,
        "Authorization": f"Bearer {args.service_key}",
        "Content-Type": "application/json",
    }

    print(f"projeto: {project_ref}")
    role = jwt_role(args.service_key)
    if role and role != "service_role":
        print(f"[!] a chave tem role '{role}', não 'service_role'.")
        print("    o backend precisa da service_role (Project Settings > API).")
        return 2
    if role == "service_role":
        print("chave: service_role (ok)")

    # 1) conectividade
    status, body = request(f"{url}/rest/v1/", headers=headers)
    if status != 200:
        print(f"[!] não consegui falar com o PostgREST (HTTP {status}): {body[:160]}")
        return 2
    print("postgrest: ok")

    # 2) tabelas
    tables = {}
    for table in ("users", "cards"):
        status, body = request(f"{url}/rest/v1/{table}?select=id&limit=1", headers=headers)
        tables[table] = status == 200
        print(f"tabela {table}: {'ok' if status == 200 else f'ausente (HTTP {status})'}")

    # 3) bucket
    status, body = request(f"{url}/storage/v1/bucket/{args.bucket}", headers=headers)
    bucket_ok = status == 200
    print(f"bucket {args.bucket}: {'ok' if bucket_ok else f'ausente (HTTP {status})'}")

    # 4) migrations
    if not all(tables.values()) or not bucket_ok:
        if args.access_token:
            print("\naplicando migrations pelo Management API…")
            for migration in MIGRATIONS:
                sql = migration.read_text(encoding="utf-8")
                status, body = request(
                    f"https://api.supabase.com/v1/projects/{project_ref}/database/query",
                    method="POST",
                    headers={
                        "Authorization": f"Bearer {args.access_token}",
                        "Content-Type": "application/json",
                    },
                    body=json.dumps({"query": sql}).encode(),
                )
                if status in (200, 201):
                    print(f"  {migration.name}: aplicada")
                else:
                    print(f"  {migration.name}: FALHOU (HTTP {status}) {body[:200]}")
                    return 3
        else:
            print("\n[!] schema incompleto. Rode as migrations:")
            print("    supabase link --project-ref " + project_ref + " && supabase db push")
            print("    ou cole os arquivos abaixo no SQL Editor do dashboard:")
            for migration in MIGRATIONS:
                print(f"      - {migration.relative_to(ROOT)}")
            print("    ou repita com --access-token sbp_... para aplicar automaticamente.")
            return 3

    # 5) .env
    if not args.check_only and not args.no_write:
        env_path = ROOT / ".env"
        if not env_path.exists():
            print("[!] .env não existe; rode o script de geração primeiro.")
            return 4
        text = env_path.read_text(encoding="utf-8")
        replacements = {
            "STORAGE_BACKEND": "supabase",
            "SUPABASE_URL": url,
            "SUPABASE_SERVICE_ROLE_KEY": args.service_key,
            "SUPABASE_BUCKET": args.bucket,
        }
        for key, value in replacements.items():
            pattern = re.compile(rf"^{key}=.*$", re.MULTILINE)
            if pattern.search(text):
                text = pattern.sub(f"{key}={value}", text)
            else:
                text += f"\n{key}={value}"
        env_path.write_text(text, encoding="utf-8")
        print("\n.env atualizado: STORAGE_BACKEND=supabase")

    print("\npróximos passos:")
    print("  1. reinicie a API (uvicorn) para carregar o .env")
    print("  2. curl http://127.0.0.1:8000/health  -> database: true")
    print("  3. faça um cadastro e suba uma arte; ela deve aparecer no bucket", args.bucket)
    return 0


if __name__ == "__main__":
    sys.exit(main())
