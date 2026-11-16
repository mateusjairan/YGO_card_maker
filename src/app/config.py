"""Configuração central da aplicação (12-factor: tudo vem do ambiente)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET_KEY = "dev-secret-change-me-please-with-32-bytes-min"
LOCAL_HOSTS = ("localhost", "127.0.0.1")


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente / arquivo .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- aplicação -----------------------------------------------------------
    app_name: str = "YGO Card Maker API"
    app_env: str = "development"  # development | test | production
    log_level: str = "INFO"
    log_format: str = "json"  # json | pretty

    # --- URLs ----------------------------------------------------------------
    public_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- persistência --------------------------------------------------------
    storage_backend: str = "sqlite"  # sqlite | supabase
    sqlite_path: str = "./data/cards.db"
    upload_dir: str = "./data/uploads"
    media_base_url: str = ""  # vazio => {public_base_url}/media

    # --- Supabase ------------------------------------------------------------
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_bucket: str = "card-images"

    # --- regras de negócio ---------------------------------------------------
    secret_key: str = DEV_SECRET_KEY
    access_token_ttl_minutes: int = 60 * 24 * 7
    max_uploads_per_user: int = 5
    image_output_px: int = 1024
    max_upload_mb: int = 6
    max_cards_per_owner: int = 200

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def media_url(self) -> str:
        base = self.media_base_url or f"{self.public_base_url}/media"
        return base.rstrip("/")

    @property
    def use_supabase(self) -> bool:
        return self.storage_backend.lower() == "supabase"

    def ensure_local_dirs(self) -> None:
        """Cria diretórios locais usados pelo backend sqlite/filesystem."""
        if self.use_supabase:
            return
        Path(self.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)

    def production_warnings(self) -> list[str]:
        """Configurações que quebram ou enfraquecem o deploy em produção.

        O `create_app` loga cada item como WARNING — o Render mostra no log do
        deploy, e é o jeito mais rápido de perceber que uma variável do
        `render.yaml` não foi preenchida (URLs locais, segredo de dev, CORS).
        """
        if self.app_env.lower() != "production":
            return []

        problems: list[str] = []
        if self.secret_key == DEV_SECRET_KEY:
            problems.append("SECRET_KEY com o valor de desenvolvimento: os JWT podem ser forjados.")

        for name, value in (
            ("PUBLIC_BASE_URL", self.public_base_url),
            ("FRONTEND_BASE_URL", self.frontend_base_url),
        ):
            if any(host in value for host in LOCAL_HOSTS):
                problems.append(
                    f"{name} aponta para {value}: links e metadados Open Graph sairão errados."
                )

        if any(host in origin for origin in self.cors_origin_list for host in LOCAL_HOSTS):
            problems.append(
                "CORS_ORIGINS ainda tem origem local: o front de produção seria bloqueado."
            )

        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()
