"""Transversal aspect: image attachments.

Player images are validated by their own bytes, stored privately beside the session checkout (never
inside it, so they are not committed) and removed with the session directory. Events carry only
`Image.payload()` metadata: bytes are read from disk by the provider adapters and by the download
endpoint, so the replayed event log stays small.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from mic_sessions.shared.web import ApiException

MEDIA_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
MAX_IMAGES = 8
# Decoded bytes per image: its base64 form stays within the 5 MB per-image provider limit.
MAX_BYTES = 3_750_000
MAX_ENCODED = 4 * -(-MAX_BYTES // 3)
_ID = re.compile(r"^[0-9a-f]{32}$")
_DIRECTORY = "images"


@dataclass(frozen=True)
class Upload:
    """One image as received on the wire, before validation."""

    data: str
    media_type: str
    name: str | None = None
    width: int | None = None
    height: int | None = None


@dataclass(frozen=True)
class Image:
    id: str
    media_type: str
    name: str
    size: int
    width: int | None
    height: int | None
    path: Path

    def payload(self) -> dict[str, Any]:
        return {"id": self.id, "mediaType": self.media_type, "name": self.name, "size": self.size,
                "width": self.width, "height": self.height}

    def base64(self) -> str:
        return base64.b64encode(self.path.read_bytes()).decode("ascii")


def _sniff(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _dimension(value: int | None) -> int | None:
    """Layout hints only: the client measured them while preparing the image."""
    return value if isinstance(value, int) and 0 < value <= 20_000 else None


def _directory(workspace: Path) -> Path:
    return workspace.parent / _DIRECTORY


def _decode(upload: Upload) -> tuple[bytes, str]:
    if len(upload.data) > MAX_ENCODED:
        raise ApiException(413, "Each image must be 3.5 MB or smaller")
    try:
        data = base64.b64decode(upload.data, validate=True)
    except (binascii.Error, ValueError):
        raise ApiException.bad_request("An image is not valid base64") from None
    media_type = _sniff(data)
    if media_type is None or media_type not in MEDIA_TYPES:
        raise ApiException(415, "Only PNG, JPEG, WebP and GIF images are supported")
    if not data or len(data) > MAX_BYTES:
        raise ApiException(413, "Each image must be 3.5 MB or smaller")
    return data, media_type


async def store(workspace: Path, uploads: list[Upload]) -> list[Image]:
    """Validate every upload before writing any, so a rejected message leaves nothing behind."""
    if len(uploads) > MAX_IMAGES:
        raise ApiException.bad_request(f"Attach at most {MAX_IMAGES} images per message")
    decoded = [(upload, *_decode(upload)) for upload in uploads]
    directory = _directory(workspace)

    def write() -> list[Image]:
        directory.mkdir(mode=0o700, exist_ok=True)
        images = []
        for upload, data, media_type in decoded:
            image_id = uuid4().hex
            path = directory / f"{image_id}{MEDIA_TYPES[media_type]}"
            path.write_bytes(data)
            path.chmod(0o600)
            name = (upload.name or "").strip()[:200] or f"image{MEDIA_TYPES[media_type]}"
            images.append(Image(image_id, media_type, name, len(data),
                                _dimension(upload.width), _dimension(upload.height), path))
        return images

    return await asyncio.to_thread(write) if decoded else []


def locate(workspace: Path, image_id: str) -> tuple[Path, str]:
    """The stored file and its media type; unknown and malformed ids are indistinguishable."""
    if _ID.fullmatch(image_id):
        for media_type, suffix in MEDIA_TYPES.items():
            path = _directory(workspace) / f"{image_id}{suffix}"
            if path.is_file() and not path.is_symlink():
                return path, media_type
    raise ApiException.not_found("Unknown image")
