"""Aponta o projeto para as URLs publicadas (Render + Pages).

Uso:
    python scripts/set-deploy-url.py --api https://sua-api.onrender.com \
                                     --web https://seu-site.pages.dev

Atualiza:
  - web/public/_redirects (proxy do Pages para a API)
  - .env (PUBLIC_BASE_URL, FRONTEND_BASE_URL, CORS_ORIGINS)
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Configura as URLs de produção")
    parser.add_argument("--api", required=True, help="URL pública da API (Render)")
    parser.add_argument("--web", help="URL pública do front (Pages/Worker); opcional")
    args = parser.parse_args()

    api = args.api.rstrip("/")
    web = (args.web or "").rstrip("/")
    if not api.startswith("https://") or (web and not web.startswith("https://")):
        print("[!] as URLs precisam ser https")
        return 2

    redirects = ROOT / "web" / "public" / "_redirects"
    text = redirects.read_text(encoding="utf-8")
    text = re.sub(r"https://[a-z0-9.-]+\.onrender\.com", api, text)
    text = re.sub(r"https://SEU-SERVICO\.onrender\.com", api, text)
    if web:
        text = re.sub(r"https://[a-z0-9.-]+\.pages\.dev", web, text)
    redirects.write_text(text, encoding="utf-8")
    print(f"_redirects -> {api}")

    env_path = ROOT / ".env"
    if env_path.exists():
        env = env_path.read_text(encoding="utf-8")
        replacements = {"PUBLIC_BASE_URL": api}
        if web:
            replacements["FRONTEND_BASE_URL"] = web
            replacements["CORS_ORIGINS"] = f"{web},http://localhost:5173"
        for key, value in replacements.items():
            pattern = re.compile(rf"^{key}=.*$", re.MULTILINE)
            env = (
                pattern.sub(f"{key}={value}", env)
                if pattern.search(env)
                else env + f"\n{key}={value}"
            )
        env_path.write_text(env, encoding="utf-8")
        print(f".env -> PUBLIC_BASE_URL={api}")
        print(f".env -> FRONTEND_BASE_URL={web}")

    print("\npróximos passos:")
    print("  1. git add -A && git commit -m 'chore(deploy): aponta para produção' && git push")
    print(f"  2. node scripts/deploy-check.mjs {api} {web}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
