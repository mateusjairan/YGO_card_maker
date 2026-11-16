"""Testes da configuração — em especial o aviso de produção mal configurada."""

from __future__ import annotations

from app.config import DEV_SECRET_KEY


def test_producao_sem_pendencias(settings):
    producao = settings.model_copy(
        update={
            "app_env": "production",
            "secret_key": "segredo-forte-de-producao-com-32-bytes-ok",
            "public_base_url": "https://ygo-card-maker.onrender.com",
            "frontend_base_url": "https://ygo-card-maker.mateusjairan.workers.dev",
            "cors_origins": "https://ygo-card-maker.mateusjairan.workers.dev",
        }
    )

    assert producao.production_warnings() == []


def test_producao_avisa_urls_locais_e_segredo_de_dev(settings):
    producao = settings.model_copy(
        update={
            "app_env": "production",
            "secret_key": DEV_SECRET_KEY,
            "public_base_url": "http://127.0.0.1:8000",
            "frontend_base_url": "http://localhost:5173",
            "cors_origins": "http://localhost:5173",
        }
    )

    problemas = " ".join(producao.production_warnings())

    assert producao.secret_key == DEV_SECRET_KEY
    assert "SECRET_KEY" in problemas
    assert "PUBLIC_BASE_URL" in problemas
    assert "FRONTEND_BASE_URL" in problemas
    assert "CORS_ORIGINS" in problemas


def test_fora_de_producao_nao_avisa(settings):
    assert settings.app_env == "test"
    assert settings.production_warnings() == []
