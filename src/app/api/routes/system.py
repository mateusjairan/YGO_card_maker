"""Rotas de infraestrutura: health check e métricas."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app import __version__
from app.core.metrics import metrics_response
from app.domain.schemas import HealthStatus

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthStatus, include_in_schema=False)
def health(request: Request, response: Response) -> HealthStatus:
    """Verifica a app e a dependência de persistência (usado no Docker/compose)."""
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
