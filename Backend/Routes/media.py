"""Local uploads, dev only. main.py mounts this router only when Cloudinary is not configured."""

import re
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from config import settings
from Utils.errors import fail

media_router = APIRouter()

NAME = re.compile(r"^[a-z0-9]{8,40}\.(jpg|png|webp)$")


@media_router.get("/{name}")
def get_media(name: str):
    # The strict name pattern is also the path-traversal guard.
    path = Path(settings.MEDIA_DIR) / name
    if not NAME.match(name) or not path.is_file():
        raise fail(404, "not_found", "No such file.")
    # Names are content hashes, so a file never changes under its URL.
    return FileResponse(path, headers={"Cache-Control": "public, max-age=31536000, immutable"})
