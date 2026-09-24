from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select, update

from conftest import OWNER
from main import app
from tables import RefreshToken, Staff

CSRF = {"X-Crown": "1"}


def login(client, remember=True):
    return client.post("/api/auth/login", headers=CSRF,
                       json={"email": OWNER[0], "password": OWNER[1], "remember": remember})


def set_cookies(resp) -> dict[str, str]:
    return {h.split("=", 1)[0]: h for h in resp.headers.get_list("set-cookie")}


def test_login_sets_three_cookies_and_me_works(client):
    r = client.post("/api/auth/login", headers=CSRF,
                    json={"email": "  Owner@CrownBarberShop.ca ", "password": OWNER[1], "remember": True})
    assert r.status_code == 200
    assert r.json() == {"email": OWNER[0], "name": "Crown owner", "role": "owner"}
    cookies = set_cookies(r)
    assert "HttpOnly" in cookies["crown_access"] and "Path=/;" in cookies["crown_access"]
    assert "HttpOnly" in cookies["crown_refresh"] and "Path=/api/auth" in cookies["crown_refresh"]
    assert "Max-Age=2592000" in cookies["crown_refresh"]
    assert "HttpOnly" not in cookies["crown_signed_in"]
    assert all("SameSite=lax" in c for c in cookies.values())
    assert client.get("/api/auth/me").json()["email"] == OWNER[0]


def test_session_cookie_without_remember(client):
    cookies = set_cookies(login(client, remember=False))
    assert "Max-Age" not in cookies["crown_refresh"]
    assert "Max-Age" not in cookies["crown_signed_in"]


def test_bad_credentials_same_response(client):
    wrong = client.post("/api/auth/login", headers=CSRF, json={"email": OWNER[0], "password": "nope"})
    unknown = client.post("/api/auth/login", headers=CSRF, json={"email": "x@y.ca", "password": "nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {
        "detail": {"code": "invalid_credentials", "message": "That email and password do not match."}}


def test_csrf_header_required(client, admin):
    r = client.post("/api/auth/login", json={"email": OWNER[0], "password": OWNER[1]})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "csrf"
    admin.headers.pop("X-Crown")
    r = admin.put("/api/admin/closures", json=[])
    assert r.status_code == 403 and r.json()["detail"]["code"] == "csrf"
    assert admin.get("/api/admin/state").status_code == 200  # GET needs no header


def test_admin_requires_login(client):
    r = client.get("/api/admin/state")
    assert r.status_code == 401 and r.json()["detail"]["code"] == "unauthenticated"
    client.cookies.set("crown_access", "not-a-jwt")
    assert client.get("/api/auth/me").status_code == 401


def test_refresh_rotates(client):
    login(client)
    first = client.cookies.get("crown_refresh", path="/api/auth")
    r = client.post("/api/auth/refresh", headers=CSRF)
    assert r.status_code == 200 and r.json()["email"] == OWNER[0]
    second = client.cookies.get("crown_refresh", path="/api/auth")
    assert second and second != first
    assert "Max-Age=2592000" in set_cookies(r)["crown_refresh"]  # keeps the remember choice


def _refresh_with(token: str):
    c = TestClient(app, headers=CSRF)
    c.cookies.set("crown_refresh", token, path="/api/auth")
    return c.post("/api/auth/refresh")


def test_refresh_reuse_revokes_family(client, db):
    login(client)
    a = client.cookies.get("crown_refresh", path="/api/auth")
    assert client.post("/api/auth/refresh", headers=CSRF).status_code == 200
    assert client.post("/api/auth/refresh", headers=CSRF).status_code == 200  # a -> b -> c: b was used
    c = client.cookies.get("crown_refresh", path="/api/auth")

    r = _refresh_with(a)
    assert r.status_code == 401 and r.json()["detail"]["code"] == "refresh_reused"
    assert any(h.startswith('crown_refresh=""') for h in r.headers.get_list("set-cookie"))
    # The whole family is dead, including the newest token.
    assert _refresh_with(c).json()["detail"]["code"] == "refresh_reused"
    assert all(t.is_revoked for t in db.scalars(select(RefreshToken)))


def test_lost_response_grace_one_hop(client):
    login(client)
    a = client.cookies.get("crown_refresh", path="/api/auth")
    assert client.post("/api/auth/refresh", headers=CSRF).status_code == 200  # a -> b, b never "arrived"
    retry = _refresh_with(a)
    assert retry.status_code == 200
    # The grace is one hop: replaying a again, now that b has been consumed, is theft.
    assert _refresh_with(a).json()["detail"]["code"] == "refresh_reused"


def test_refresh_expired(client, db):
    login(client)
    db.execute(update(RefreshToken).values(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
    db.commit()
    r = client.post("/api/auth/refresh", headers=CSRF)
    assert r.status_code == 401 and r.json()["detail"]["code"] == "refresh_expired"


def test_refresh_without_cookie(client):
    r = client.post("/api/auth/refresh", headers=CSRF)
    assert r.status_code == 401 and r.json()["detail"]["code"] == "refresh_invalid"


def test_token_version_bump_kills_access(admin, db):
    db.execute(update(Staff).values(token_version=Staff.token_version + 1))
    db.commit()
    assert admin.get("/api/auth/me").status_code == 401


def test_logout_revokes_and_clears(admin):
    token = admin.cookies.get("crown_refresh", path="/api/auth")
    r = admin.post("/api/auth/logout")
    assert r.status_code == 204
    assert {h.split("=", 1)[0] for h in r.headers.get_list("set-cookie")} == {
        "crown_access", "crown_refresh", "crown_signed_in"}
    assert _refresh_with(token).status_code == 401
    assert TestClient(app, headers=CSRF).post("/api/auth/logout").status_code == 204  # idempotent


def test_staff_role_cannot_reset_demo(admin, db):
    from config import settings
    settings.DEMO_MODE = True
    db.execute(update(Staff).values(role="staff"))
    db.commit()
    r = admin.post("/api/admin/demo/reset")
    assert r.status_code == 403 and r.json()["detail"]["code"] == "forbidden"
