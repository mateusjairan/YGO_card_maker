"""Upload da arte da carta (com cota por duelista)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, UploadFile, status

from app.api.deps import current_user, get_upload_service
from app.core.errors import UploadError
from app.domain.models import User
from app.domain.schemas import UploadResult
from app.services.uploads import UploadService

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("", response_model=UploadResult, status_code=status.HTTP_201_CREATED)
async def upload_image(
    request: Request,
    file: Annotated[UploadFile, File(description="Imagem JPEG, PNG ou WebP")],
    service: Annotated[UploadService, Depends(get_upload_service)],
    user: Annotated[User, Depends(current_user)],
) -> UploadResult:
    """Recebe a arte, padroniza em 1024×1024 WebP e consome 1 upload da cota."""
    settings = request.app.state.settings
    limit = settings.max_upload_mb * 1024 * 1024

    raw = await file.read(limit + 1)
    if len(raw) > limit:
        raise UploadError(f"Imagem maior que {settings.max_upload_mb} MB")

    outcome = service.store(raw, file.content_type or "application/octet-stream", user)
    return UploadResult(
        url=outcome.stored.url,
        path=outcome.stored.path,
        width=outcome.width,
        height=outcome.height,
        uploads_used=outcome.uploads_used,
        uploads_limit=settings.max_uploads_per_user,
    )
