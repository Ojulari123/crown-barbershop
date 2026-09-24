import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from config import settings
from db import engine
from Routes.admin import admin_router
from Routes.auth import auth_router
from Routes.media import media_router
from Routes.public import public_router
from Utils.rate_limit import limiter, rate_limited_handler
from Utils.scheduler import build_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# The 5-second outbox job would otherwise log two INFO lines per run.
logging.getLogger("apscheduler").setLevel(logging.WARNING)
log = logging.getLogger("crown")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Started here, not at import, so tests and scripts that import the app never run jobs.
    scheduler = build_scheduler()
    scheduler.start()
    log.info("scheduler started; sms dry run=%s", settings.sms_dry_run)
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Crown Barber Shop API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limited_handler)

# The browser normally calls same-origin /api/* through the Next rewrite; CORS only
# matters for direct calls, and only the frontend origin may make them with cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Crown"],
)

app.include_router(public_router, prefix="/api/public", tags=["public"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
if not settings.cloudinary_enabled:
    app.include_router(media_router, prefix="/api/media", tags=["media"])


@app.get("/api/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"ok": True}
