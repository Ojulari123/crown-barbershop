"""Tests run against a real Postgres (advisory locks, partial indexes and SKIP LOCKED
do not exist in SQLite). The schema comes from migrate.py, never from create_all.

    TEST_DATABASE_URL defaults to the local throwaway cluster's crown_test database.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres@127.0.0.1:5544/crown_test")
# Must be set before config/db are imported: db.py builds the engine at import time.
os.environ["DATABASE_URL"] = TEST_DB
os.environ.setdefault("JWT_SECRET", "test-only-secret-not-used-anywhere-else")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import seed  # noqa: E402
from config import settings  # noqa: E402
from db import SessionLocal, engine  # noqa: E402
from main import app  # noqa: E402
from Utils.rate_limit import limiter  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent
# Friday 2026-09-25 10:15 Toronto, the fidelity freeze instant.
NOW = "2026-09-25T10:15:00-04:00"
TODAY = "2026-09-25"
OWNER = ("owner@crownbarbershop.ca", "crown2026")
TABLES = ("sms_outbox", "media", "photos", "messages", "bookings", "closures", "shop_settings",
          "barbers", "services", "refresh_tokens", "staff")


@pytest.fixture(scope="session", autouse=True)
def schema():
    """Fresh schema, then the real migration runner."""
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    result = subprocess.run([sys.executable, "migrate.py", "up"], cwd=BACKEND, capture_output=True, text=True,
                            env={**os.environ, "DATABASE_URL": TEST_DB})
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.fixture(autouse=True)
def clean(schema, tmp_path):
    # A populated Backend/.env must not leak into tests: pin every behaviour-changing setting.
    settings.ENV = "test"
    settings.CROWN_CLOCK_OVERRIDE = NOW
    settings.DEMO_MODE = False
    settings.TRUST_PROXY = False
    settings.SMS_DRY_RUN = False
    settings.CROWN_SHOP_SMS_TO = ""
    settings.TWILIO_ACCOUNT_SID = settings.TWILIO_AUTH_TOKEN = settings.TWILIO_FROM_NUMBER = ""
    settings.CROWN_CLOUDINARY_CLOUD_NAME = ""
    settings.CROWN_OWNER_EMAIL = settings.CROWN_OWNER_PASSWORD = settings.CROWN_OWNER_NAME = ""
    settings.MEDIA_DIR = str(tmp_path / "media")
    limiter.enabled = False
    limiter.reset()
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"))
    with SessionLocal() as db:
        seed.seed_defaults(db)
        seed.seed_owner(db, demo=True)
        db.commit()
    yield


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin():
    """Signed-in owner client that sends the CSRF header on every request."""
    c = TestClient(app, headers={"X-Crown": "1"})
    r = c.post("/api/auth/login", json={"email": OWNER[0], "password": OWNER[1], "remember": True})
    assert r.status_code == 200, r.text
    return c


def booking_body(**over):
    body = {"serviceId": "fade", "barberId": "tania", "date": TODAY, "time": 660,
            "name": "Test Client", "phone": "5195550100", "note": ""}
    return {**body, **over}


def admin_booking(**over):
    body = {"id": "adm-1", "createdAt": 1790000100000, "name": "Walk-in", "phone": "", "note": "",
            "serviceId": "fade", "barberId": "tania", "date": TODAY, "time": 615,
            "status": "done", "source": "walk-in"}
    return {**body, **over}
