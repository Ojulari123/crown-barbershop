"""Passwords, access JWTs, rotating refresh tokens, and the admin guards.

Adapted from Housing Utils/security.py: one staff table instead of four identity
tables, tokens in httpOnly cookies instead of the response body.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, Request
from jose import JWTError, jwt
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from tables import RefreshToken, Staff
from Utils.errors import fail

ACCESS_COOKIE = "crown_access"
REFRESH_COOKIE = "crown_refresh"
HINT_COOKIE = "crown_signed_in"

# How long after a rotation the superseded token may still be presented without being
# treated as theft: a cancelled request plus the user pressing Back. An attacker must
# replay inside it AND beat the real client to the unused successor.
REFRESH_ROTATION_GRACE_SECONDS = 30


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# Unknown emails still pay for one bcrypt check, so response time does not reveal
# which addresses have accounts.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def create_access_token(staff: Staff) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    claims = {"sub": str(staff.id), "role": staff.role, "tv": staff.token_version, "exp": exp}
    return jwt.encode(claims, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_refresh_token(db: Session, staff_id: int, persistent: bool, family_id: uuid.UUID | None = None) -> str:
    """Store the SHA-256 of a new opaque token and return the raw value (never stored)."""
    raw = secrets.token_urlsafe(64)
    db.add(RefreshToken(
        token_hash=hash_token(raw),
        staff_id=staff_id,
        family_id=family_id or uuid.uuid4(),
        persistent=persistent,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.flush()
    return raw


def _find(db: Session, token_hash: str) -> RefreshToken | None:
    # FOR UPDATE: two tabs refreshing with the same token serialise here, and the second
    # one takes the lost-response path below instead of tripping reuse detection.
    return db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update())


def _is_lost_response_retry(successor: RefreshToken | None) -> bool:
    """The revoked token's successor was issued moments ago and never used: the client
    never received the rotation response, so this is not theft."""
    if successor is None or successor.is_revoked:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=REFRESH_ROTATION_GRACE_SECONDS)
    return successor.created_at >= cutoff


def rotate_refresh_token(db: Session, raw: str) -> tuple[Staff, str, bool]:
    """Revoke the presented token and issue its successor in the same family.

    Presenting an already-revoked token (outside the one-hop grace) revokes the whole
    family: every session from that login must sign in again.
    Returns (staff, new raw token, persistent).
    """
    stored = _find(db, hash_token(raw))
    if stored is None:
        raise fail(401, "refresh_invalid", "Please sign in again.")

    if stored.is_revoked:
        successor = _find(db, stored.replaced_by) if stored.replaced_by else None
        if _is_lost_response_retry(successor):
            stored = successor
        else:
            db.execute(update(RefreshToken).where(RefreshToken.family_id == stored.family_id)
                       .values(is_revoked=True))
            db.commit()
            raise fail(401, "refresh_reused", "Please sign in again.")

    if stored.expires_at < datetime.now(timezone.utc):
        stored.is_revoked = True
        db.commit()
        raise fail(401, "refresh_expired", "Please sign in again.")

    staff = db.get(Staff, stored.staff_id)
    if staff is None:
        stored.is_revoked = True
        db.commit()
        raise fail(401, "refresh_invalid", "Please sign in again.")

    new_raw = issue_refresh_token(db, staff.id, stored.persistent, stored.family_id)
    stored.is_revoked = True
    stored.replaced_by = hash_token(new_raw)
    db.commit()
    return staff, new_raw, stored.persistent


def revoke_refresh_token(db: Session, raw: str) -> None:
    db.execute(update(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)).values(is_revoked=True))
    db.commit()


def require_csrf(request: Request) -> None:
    """Non-GET auth/admin calls must carry X-Crown: 1. A custom header forces a CORS
    preflight, which only FRONTEND_ORIGIN passes (api-contract.md 0)."""
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("x-crown") != "1":
        raise fail(403, "csrf", "Missing X-Crown header.")


def get_current_staff(request: Request, db: Session = Depends(get_db)) -> Staff:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise fail(401, "unauthenticated", "Please sign in.")
    try:
        claims = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        staff = db.get(Staff, int(claims["sub"]))
    except (JWTError, KeyError, ValueError):
        raise fail(401, "unauthenticated", "Please sign in.")
    # token_version is bumped on password change, which kills every outstanding JWT.
    if staff is None or claims.get("tv") != staff.token_version:
        raise fail(401, "unauthenticated", "Please sign in.")
    return staff
