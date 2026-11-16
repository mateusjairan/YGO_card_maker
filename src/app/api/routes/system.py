"""Rotas de infraestrutura: health check e métricas."""

from __future__ import annotations

import time

from fastapi import APIRouter, Request, Response, status

from app import __version__
from app.core.metrics import metrics_response
from app.domain.schemas import HealthStatus

router = APIRouter(tags=["system"])

_STARTED_AT = time.monotonic()


@router.get("/health/live", include_in_schema=False)
def liveness() -> dict[str, object]:
    """Sinal de vida barato: não toca banco nem storage.

    Existe para o keep-alive (cron externo ou GitHub Actions) e para o health
    check do Render: um ping a cada 10 min não deve gastar conexão com o
    Supabase nem derrubar a instância quando o banco está lento.
    """
    return {"status": "ok", "uptime_s": round(time.monotonic() - _STARTED_AT, 1)}


@router.get("/health", response_model=HealthStatus, include_in_schema=False)
def health(request: Request, response: Response) -> HealthStatus:
    """Readiness: verifica a app e a dependência de persistência (ver compose)."""
    settings = request.app.state.settings
    database_ok = request.app.state.repository.ping()

    if not database_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthStatus(
        status="ok" if database_ok else "degraded",
        app=settings.app_name,
        env=settings.app_env,
        storage=settings.storage_backend,
        version=__version__,
        checks={"database": database_ok},
    )


@router.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    """Formato de exposição do Prometheus (usado pelo Grafana e pelo SLO)."""
    return metrics_response()
