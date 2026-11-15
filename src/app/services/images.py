"""Processamento de imagens (validação, orientação e reencode para WebP)."""

from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import UploadError

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

MAX_SIDE = 1400
WEBP_QUALITY = 82


def process_image(raw: bytes, *, content_type: str, max_bytes: int) -> tuple[bytes, int, int]:
    """Valida e normaliza a imagem. Retorna (webp_bytes, width, height)."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UploadError("Envie uma imagem JPEG, PNG ou WebP")
    if not raw:
        raise UploadError("Arquivo vazio")
    if len(raw) > max_bytes:
        raise UploadError(f"Imagem maior que {max_bytes // (1024 * 1024)} MB")

    try:
        with Image.open(BytesIO(raw)) as probe:
            probe.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise UploadError("O arquivo enviado não é uma imagem válida") from exc

    try:
        with Image.open(BytesIO(raw)) as source:
            image = ImageOps.exif_transpose(source)
            image = image.convert("RGBA")
            image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)

            buffer = BytesIO()
            image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=6)
            return buffer.getvalue(), image.width, image.height
    except OSError as exc:  # pragma: no cover - falha de encode
        raise UploadError("Não foi possível processar a imagem") from exc
