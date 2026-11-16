"""Gera docs/openapi.yaml a partir da aplicação (fonte única: o código)."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402


def main() -> None:
    settings = Settings(
        app_env="production",
        storage_backend="sqlite",
        sqlite_path=str(ROOT / "data" / "openapi.db"),
        upload_dir=str(ROOT / "data" / "uploads"),
        public_base_url="https://ygo-card-maker-api.onrender.com",
        frontend_base_url="https://ygo-card-maker.pages.dev",
        # valores de produção só para o schema sair sem os avisos de config
        cors_origins="https://ygo-card-maker.pages.dev",
        secret_key="openapi-export-apenas-para-gerar-o-schema-32b",
    )
    application = create_app(settings)
    schema = application.openapi()

    output = ROOT / "docs" / "openapi.yaml"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        yaml.safe_dump(schema, sort_keys=True, allow_unicode=True, width=110),
        encoding="utf-8",
        newline="\n",
    )
    print(f"OpenAPI gerado em {output.relative_to(ROOT)} ({len(schema['paths'])} rotas)")


if __name__ == "__main__":
    main()
