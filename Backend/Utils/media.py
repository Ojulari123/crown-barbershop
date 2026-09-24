"""Image storage: Cloudinary (signed REST upload via httpx, no SDK) or the local media dir.

Local storage is for development only: Render's disk is wiped on deploy (validation.md V20).
"""

import hashlib
import time
from pathlib import Path

import httpx

from config import settings

MAX_BYTES = 5 * 1024 * 1024


def sniff_ext(data: bytes) -> str | None:
    """Type by magic bytes, not the client's Content-Type (validation.md V33)."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def store(data: bytes, ext: str, kind: str) -> tuple[str, str, str]:
    """Save the file. Returns (url, storage, storage_key)."""
    digest = hashlib.sha256(data).hexdigest()[:24]
    if settings.cloudinary_enabled:
        return _cloudinary(data, ext, kind, digest)
    name = f"{digest}.{ext}"
    folder = Path(settings.MEDIA_DIR)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / name).write_bytes(data)
    return f"/api/media/{name}", "local", name


def _cloudinary(data: bytes, ext: str, kind: str, digest: str) -> tuple[str, str, str]:
    params = {"folder": f"crown/{kind}", "public_id": digest, "timestamp": str(int(time.time()))}
    # Cloudinary signature: sorted key=value pairs joined by '&', then the secret, SHA-1.
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params)) + settings.CROWN_CLOUDINARY_API_SECRET
    resp = httpx.post(
        f"https://api.cloudinary.com/v1_1/{settings.CROWN_CLOUDINARY_CLOUD_NAME}/image/upload",
        data={**params, "api_key": settings.CROWN_CLOUDINARY_API_KEY,
              "signature": hashlib.sha1(to_sign.encode()).hexdigest()},
        files={"file": (f"{digest}.{ext}", data)},
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()
    return body["secure_url"], "cloudinary", body["public_id"]
