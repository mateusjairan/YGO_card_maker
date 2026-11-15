"""Contrato de armazenamento de imagens."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class StoredImage:
    url: str
    path: str


@runtime_checkable
class ImageStorage(Protocol):
    """Onde a arte da carta é guardada (disco local ou Supabase Storage)."""

    def save(self, data: bytes, *, filename: str, content_type: str) -> StoredImage: ...

    def delete(self, path: str) -> None: ...
