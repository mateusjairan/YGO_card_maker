"""Ponto de entrada da API: montagem de dependências, middlewares e rotas."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.routes import auth, cards, pages, system, uploads
from app.config import Settings, get_settings
from app.core.errors import AppError
from app.core.logging import RequestContextMiddleware, configure_logging
from app.core.metrics import setup_metrics
from app.repositories.factory import build_repository
from app.services.auth import AuthService
from app.services.cards import CardService
from app.services.uploads import UploadService
from app.storage.factory import build_image_storage

logger = logging.getLogger(__name__)

SHARED_DIR = Path(__file__).resolve().parents[2] / "shared"
DESCRIPTION = """
API do **YGO Card Maker**: criação de cartas customizadas de Yu-Gi-Oh! com
arte própria, moldura por atributo, exportação em PNG e link compartilhável.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    settings.ensure_local_dirs()
    configure_logging(settings.log_level, settings.log_format)

    repository = build_repository(settings)
    storage = build_image_storage(settings)

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=DESCRIPTION,
        contact={"name": "Mateus Jairan", "url": "https://github.com/mateusjairan/YGO_card_maker"},
        license_info={"name": "MIT"},
    )

    # --- injeção de dependências (composition root) --------------------------
    app.state.settings = settings
    app.state.repository = repository
    app.state.storage = storage
    app.state.auth = AuthService(repository, settings)
    app.state.cards = CardService(repository, storage, settings)
    app.state.uploads = UploadService(storage, settings, repository)

    # --- middlewares ---------------------------------------------------------
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    # --- tratamento de erros -------------------------------------------------
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Dados enviados são inválidos",
                "code": "validation_error",
                "errors": jsonable_encoder(exc.errors()),
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("erro_inesperado", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Erro interno", "code": "internal_error"},
        )

    # --- rotas ---------------------------------------------------------------
    app.include_router(system.router)
    app.include_router(auth.router)
    app.include_router(cards.router)
    app.include_router(uploads.router)
    app.include_router(pages.router)

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": __version__,
            "docs": "/docs",
            "health": "/health",
            "frontend": settings.frontend_base_url,
        }

    # --- estáticos -----------------------------------------------------------
    # CSS da carta compartilhado entre o React e o HTML renderizado no servidor
    if SHARED_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=str(SHARED_DIR)), name="static")

    if not settings.use_supabase:
        app.mount(
            "/media",
            StaticFiles(directory=str(settings.upload_dir)),
            name="media",
        )

    setup_metrics(app)
    logger.info(
        "app_iniciada",
        extra={
            "env": settings.app_env,
            "storage": settings.storage_backend,
            "version": __version__,
        },
    )
    return app
