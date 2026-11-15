"""Processamento de imagens: validação, padronização quadrada e WebP."""

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

WEBP_QUALITY = 82


def standardize(image: Image.Image, *, output_px: int) -> Image.Image:
    """Recorta o centro em 1:1 e redimensiona para `output_px` (LANCZOS).

    Toda arte termina no mesmo formato, então a carta nunca "pula" de proporção
    entre uma imagem e outra.
    """
    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        rgba = image.convert("RGBA")
        background.paste(rgba, mask=rgba.split()[-1])
        image = background
    else:
        image = image.convert("RGB")

    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    image = image.crop((left, top, left + side, top + side))

    # nunca faz upscale: 2400x1600 vira 1024x1024, 80x80 continua 80x80
    target = min(output_px, side)
    return image.resize((target, target), Image.Resampling.LANCZOS)


def process_image(
    raw: bytes,
    *,
    content_type: str,
    max_bytes: int,
    output_px: int = 1024,
) -> tuple[bytes, int, int]:
    """Valida e padroniza a imagem. Devolve (webp_bytes, width, height)."""
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
            image = standardize(source, output_px=output_px)
            buffer = BytesIO()
            image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=6)
            return buffer.getvalue(), image.width, image.height
    except OSError as exc:  # pragma: no cover - falha de encode
        raise UploadError("Não foi possível processar a imagem") from exc
