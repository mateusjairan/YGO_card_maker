"""Métricas Prometheus: contadores de negócio + métricas RED de HTTP."""

from __future__ import annotations

import time

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

# --- métricas de negócio ----------------------------------------------------
CARDS_CREATED = Counter("ygo_cards_created_total", "Total de cartas criadas", ["kind"])
CARDS_UPDATED = Counter("ygo_cards_updated_total", "Total de cartas atualizadas")
CARDS_DELETED = Counter("ygo_cards_deleted_total", "Total de cartas removidas")
CARD_VIEWS = Counter("ygo_card_views_total", "Total de visualizações de cartas compartilhadas")
UPLOADS = Counter("ygo_uploads_total", "Total de uploads de imagem aceitos")

CARD_CREATE_LATENCY = Histogram(
    "ygo_card_create_duration_seconds",
    "Tempo de criação de carta (requisição até o commit)",
    buckets=(0.05, 0.1, 0.2, 0.3, 0.5, 1.0, 2.0, 5.0),
)

# --- métricas RED de HTTP ---------------------------------------------------
HTTP_REQUESTS = Counter(
    "http_requests_total",
    "Requisições HTTP por método, rota e status",
    ["method", "route", "status"],
)
HTTP_LATENCY = Histogram(
    "http_request_duration_seconds",
    "Latência das requisições HTTP por método e rota",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

_EXCLUDED = {"/metrics"}


class MetricsMiddleware(BaseHTTPMiddleware):
    """Registra taxa, erros e duração por rota (template, não URL crua)."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            self._observe(request, 500, time.perf_counter() - started)
            raise
        self._observe(request, response.status_code, time.perf_counter() - started)
        return response

    @staticmethod
    def _observe(request: Request, status_code: int, duration: float) -> None:
        route = request.scope.get("route")
        route_path = getattr(route, "path", None) or "unmatched"
        if route_path in _EXCLUDED:
            return
        HTTP_REQUESTS.labels(request.method, route_path, str(status_code)).inc()
        HTTP_LATENCY.labels(request.method, route_path).observe(duration)


def setup_metrics(app) -> None:
    """Adiciona o middleware de métricas (o endpoint /metrics vem das rotas)."""
    app.add_middleware(MetricsMiddleware)


def metrics_response() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
