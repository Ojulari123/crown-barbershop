from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from Schemas.authSchema import LoginRequest
from tables import Staff
from Utils.errors import fail
from Utils.rate_limit import limiter
from Utils.security import (ACCESS_COOKIE, DUMMY_HASH, HINT_COOKIE, REFRESH_COOKIE, create_access_token,
                            get_current_staff, issue_refresh_token, require_csrf, revoke_refresh_token,
                            rotate_refresh_token, verify_password)

auth_router = APIRouter(dependencies=[Depends(require_csrf)])

REFRESH_PATH = "/api/auth"


def session(staff: Staff) -> dict:
    return {"email": staff.email, "name": staff.name, "role": staff.role}


def set_session_cookies(response: Response, staff: Staff, refresh: str, persistent: bool) -> None:
    # "Keep me signed in" = persistent refresh + hint cookies; otherwise session cookies.
    keep = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400 if persistent else None
    common = {"samesite": "lax", "secure": settings.COOKIE_SECURE}
    response.set_cookie(ACCESS_COOKIE, create_access_token(staff), httponly=True, path="/",
                        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, **common)
    response.set_cookie(REFRESH_COOKIE, refresh, httponly=True, path=REFRESH_PATH, max_age=keep, **common)
    # Not a secret: lets Next middleware on /admin/* decide "show login" (decisions D2).
    response.set_cookie(HINT_COOKIE, "1", httponly=False, path="/", max_age=keep, **common)


def clear_session_cookies(response: Response) -> None:
    common = {"samesite": "lax", "secure": settings.COOKIE_SECURE}
    response.delete_cookie(ACCESS_COOKIE, path="/", httponly=True, **common)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH, httponly=True, **common)
    response.delete_cookie(HINT_COOKIE, path="/", **common)


@auth_router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    staff = db.scalar(select(Staff).where(Staff.email == payload.email.strip().lower()))
    ok = verify_password(payload.password, staff.password_hash if staff else DUMMY_HASH)
    if staff is None or not ok:
        raise fail(401, "invalid_credentials", "That email and password do not match.")
    refresh = issue_refresh_token(db, staff.id, payload.remember)
    db.commit()
    set_session_cookies(response, staff, refresh, payload.remember)
    return session(staff)


@auth_router.post("/refresh")
@limiter.limit("30/minute")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    try:
        if not raw:
            raise fail(401, "refresh_invalid", "Please sign in again.")
        staff, new_raw, persistent = rotate_refresh_token(db, raw)
    except HTTPException as exc:
        # A raised HTTPException drops cookies set on `response`, so build the 401 by hand.
        denied = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        clear_session_cookies(denied)
        return denied
    set_session_cookies(response, staff, new_raw, persistent)
    return session(staff)


@auth_router.post("/logout", status_code=204)
def logout(request: Request, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        revoke_refresh_token(db, raw)
    response = Response(status_code=204)
    clear_session_cookies(response)
    return response


@auth_router.get("/me")
def me(staff: Staff = Depends(get_current_staff)):
    return session(staff)
