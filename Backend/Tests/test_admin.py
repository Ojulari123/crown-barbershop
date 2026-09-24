import json
from datetime import datetime, timezone

from sqlalchemy import func, select

from config import settings
from conftest import admin_booking
from tables import Booking, Message, Photo


def detail_code(r):
    return r.json()["detail"]["code"]


def roundtrip(admin, path, slice_key, body):
    """PUT then GET must give back byte-identical JSON (the admin's JSON.stringify dirty checks)."""
    put = admin.put(path, json=body)
    assert put.status_code == 200, put.text
    got = admin.get("/api/admin/state").json()["state"][slice_key]
    assert json.dumps(put.json()) == json.dumps(got) == json.dumps(body)


def test_admin_state_shape(admin):
    r = admin.get("/api/admin/state")
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert list(body["state"]) == ["services", "barbers", "hours", "gallery", "bookings", "messages", "notice", "closures"]
    assert body["meta"] == {"mediaKb": 0, "demoMode": False,
                            "now": {"ymd": "2026-09-25", "minutes": 615, "epochMs": 1790345700000}}


def test_services_put_roundtrip(admin):
    services = admin.get("/api/admin/state").json()["state"]["services"]
    services[0]["price"] = 31.5
    services[1]["visible"] = False
    services = services[:-1] + [{"id": "k3j9x0aa8d2f", "name": "Buzz cut", "detail": "", "minutes": 15,
                                  "price": 20, "category": "cuts", "visible": True}]
    roundtrip(admin, "/api/admin/services", "services", services)


def test_services_put_validation(admin):
    base = {"id": "x", "name": "X", "detail": "", "minutes": 30, "price": 10, "category": "cuts", "visible": True}
    for bad in ({"minutes": 3}, {"price": 1000}, {"price": 10.555}, {"name": "  "}, {"category": "hats"}, {"id": "Bad Id"}):
        assert admin.put("/api/admin/services", json=[{**base, **bad}]).status_code == 422, bad
    r = admin.put("/api/admin/services", json=[base, base])
    assert r.status_code == 422 and detail_code(r) == "duplicate_id"


def test_barbers_put_roundtrip_keeps_empty_vs_missing(admin):
    barbers = [{"id": "any", "name": "First available", "note": "Shortest wait"},
               {"id": "tania", "name": "Tania", "note": "n", "role": "Barber", "bio": "", "specialties": [],
                "photo": "/api/media/ab12cd34ef56ab12cd34ef56.jpg"},
               {"id": "sam", "name": "Sam", "note": ""}]
    roundtrip(admin, "/api/admin/barbers", "barbers", barbers)


def test_barbers_put_rules(admin):
    tania = {"id": "tania", "name": "Tania", "note": ""}
    r = admin.put("/api/admin/barbers", json=[tania])
    assert r.status_code == 422 and detail_code(r) == "any_required"
    r = admin.put("/api/admin/barbers", json=[{"id": "any", "name": "First", "note": "", "bio": "x"}, tania])
    assert detail_code(r) == "any_required"
    r = admin.put("/api/admin/barbers", json=[{"id": "any", "name": "F", "note": ""},
                                              {**tania, "photo": "data:image/jpeg;base64,AAAA"}])
    assert r.status_code == 422 and detail_code(r) == "inline_image"


def test_hours_put(admin):
    hours = [[], [[540, 600]], [[600, 840], [900, 1080]], [], [], [], [[0, 1440]]]
    roundtrip(admin, "/api/admin/hours", "hours", hours)
    for bad in ([[]] * 6, [[[600, 840], [800, 900]]] + [[]] * 6, [[[900, 600]]] + [[]] * 6,
                [[[600, 1500]]] + [[]] * 6, [[[600.5, 700]]] + [[]] * 6):
        r = admin.put("/api/admin/hours", json=bad)
        assert r.status_code == 422 and detail_code(r) == "invalid_hours", bad


def test_closures_put(admin):
    r = admin.put("/api/admin/closures", json=["2026-10-12", "2026-09-01", "2026-10-12"])
    assert r.json() == ["2026-09-01", "2026-10-12"]
    assert admin.get("/api/admin/state").json()["state"]["closures"] == ["2026-09-01", "2026-10-12"]
    assert admin.put("/api/admin/closures", json=["2026-13-01"]).status_code == 422


def test_notice_put_and_delete(admin):
    r = admin.put("/api/admin/notice", json={"text": "  Closed Monday.  ", "until": "2026-10-13"})
    assert r.json() == {"text": "Closed Monday.", "until": "2026-10-13"}
    assert admin.put("/api/admin/notice", json={"text": "Open", "until": None}).status_code == 422
    assert admin.put("/api/admin/notice", json={"text": "Open late today", "until": None}).json()["until"] is None
    assert admin.delete("/api/admin/notice").status_code == 204
    assert admin.get("/api/admin/state").json()["state"]["notice"] is None


def test_booking_post_walk_in_and_rules(admin):
    r = admin.post("/api/admin/bookings", json=admin_booking())
    assert r.status_code == 201
    assert r.json() == {**admin_booking()}  # key order and values exactly as sent, no `sample`
    # A second walk-in in the same 5 minutes for the same barber is legal (status done).
    assert admin.post("/api/admin/bookings", json=admin_booking(id="adm-2")).status_code == 201
    r = admin.post("/api/admin/bookings", json=admin_booking())
    assert r.status_code == 409 and detail_code(r) == "duplicate_id"
    r = admin.post("/api/admin/bookings", json=admin_booking(id="adm-3", source="phone"))
    assert r.status_code == 422 and detail_code(r) == "invalid_phone"
    r = admin.post("/api/admin/bookings", json=admin_booking(id="adm-4", serviceId="gone"))
    assert detail_code(r) == "unknown_service"
    # Outside hours is fine for staff (walk-ins at 7:55 AM).
    assert admin.post("/api/admin/bookings", json=admin_booking(id="adm-5", time=475)).status_code == 201


def test_booking_unique_index_clash(admin):
    live = admin_booking(id="a1", time=660, status="confirmed", source="phone", phone="5195550101")
    assert admin.post("/api/admin/bookings", json=live).status_code == 201
    r = admin.post("/api/admin/bookings", json={**live, "id": "a2", "status": "requested"})
    assert r.status_code == 409 and r.json()["detail"] == {
        "code": "slot_taken", "message": "Tania already has a booking at that time."}
    # 'any' is not covered by the index: staff may squeeze people in.
    assert admin.post("/api/admin/bookings", json={**live, "id": "a3", "barberId": "any"}).status_code == 201


def test_booking_patch(admin, db):
    admin.post("/api/admin/bookings", json=admin_booking(id="p1", status="requested", source="phone",
                                                         phone="5195550101", time=660))
    r = admin.patch("/api/admin/bookings/p1", json={"barberId": "any", "time": 690, "note": "late"})
    assert r.status_code == 200 and (r.json()["barberId"], r.json()["time"], r.json()["note"]) == ("any", 690, "late")
    r = admin.patch("/api/admin/bookings/p1", json={"createdAt": 1})
    assert r.status_code == 422 and detail_code(r) == "immutable_field"
    assert admin.patch("/api/admin/bookings/p1", json={"name": None}).status_code == 422
    assert admin.patch("/api/admin/bookings/p1", json={"status": "gone"}).status_code == 422
    assert admin.patch("/api/admin/bookings/nope", json={"note": "x"}).status_code == 404
    # A booking for a since-removed service can still change status.
    db.execute(Booking.__table__.update().values(service_id="removed"))
    db.commit()
    assert admin.patch("/api/admin/bookings/p1", json={"status": "confirmed"}).status_code == 200


def test_booking_patch_undo_cancel_clash(admin):
    admin.post("/api/admin/bookings", json=admin_booking(id="u1", status="confirmed", source="phone",
                                                         phone="5195550101", time=660))
    admin.patch("/api/admin/bookings/u1", json={"status": "cancelled"})
    admin.post("/api/admin/bookings", json=admin_booking(id="u2", status="confirmed", source="phone",
                                                         phone="5195550102", time=660))
    r = admin.patch("/api/admin/bookings/u1", json={"status": "confirmed"})
    assert r.status_code == 409 and detail_code(r) == "slot_taken"


def test_message_patch(admin, db):
    db.add(Message(id="m1", name="Carol", phone="5195550158", body="Hello there"))
    db.commit()
    assert admin.patch("/api/admin/messages/m1", json={"read": True}).json()["read"] is True
    r = admin.patch("/api/admin/messages/m1", json={"archived": True, "read": False})
    assert (r.json()["archived"], r.json()["read"]) == (True, False)
    assert list(r.json()) == ["id", "createdAt", "name", "phone", "body", "read", "archived"]
    for bad in ({}, {"body": "x"}, {"read": None}, {"read": "maybe"}):
        assert admin.patch("/api/admin/messages/m1", json=bad).status_code == 422, bad
    assert admin.patch("/api/admin/messages/nope", json={"read": True}).status_code == 404


PHOTO = {"id": "ph1", "src": "https://images.example/a.jpg", "caption": "", "style": "classic",
         "featured": False, "createdAt": 1790000100000}


def test_gallery_crud_and_restore(admin, db):
    r = admin.post("/api/admin/gallery", json={**PHOTO, "createdAt": 1790000100123})
    assert r.status_code == 201 and r.json() == {**PHOTO, "createdAt": 1790000100123}
    assert admin.post("/api/admin/gallery", json=PHOTO).status_code == 409
    r = admin.patch("/api/admin/gallery/ph1", json={"caption": "Fresh fade", "featured": True, "createdAt": 5})
    assert (r.json()["caption"], r.json()["featured"], r.json()["createdAt"]) == ("Fresh fade", True, 5)
    assert admin.delete("/api/admin/gallery/ph1").status_code == 204
    assert admin.delete("/api/admin/gallery/ph1").status_code == 404
    assert admin.patch("/api/admin/gallery/ph1", json={"caption": "x"}).status_code == 404
    assert admin.get("/api/admin/state").json()["state"]["gallery"] == []
    # Undo = POST the same id: restored with 200.
    r = admin.post("/api/admin/gallery", json=PHOTO)
    assert r.status_code == 200 and r.json() == PHOTO
    assert db.scalar(select(func.count()).select_from(Photo)) == 1


def test_gallery_restore_keeps_sample_flag(admin, db):
    db.add(Photo(id="sample-0", src=PHOTO["src"], style="fade", featured=True, sample=True,
                 created_at=datetime.now(timezone.utc)))
    db.commit()
    admin.delete("/api/admin/gallery/sample-0")
    r = admin.post("/api/admin/gallery", json={**PHOTO, "id": "sample-0", "sample": False})
    assert r.status_code == 200 and r.json()["sample"] is True


def test_gallery_rejects_inline_and_bad_urls(admin):
    r = admin.post("/api/admin/gallery", json={**PHOTO, "src": "data:image/jpeg;base64,AAAA"})
    assert r.status_code == 422 and detail_code(r) == "inline_image"
    assert admin.post("/api/admin/gallery", json={**PHOTO, "src": "http://x.test/a.jpg"}).status_code == 422
    assert admin.post("/api/admin/gallery", json={**PHOTO, "style": "mullet"}).status_code == 422
    assert admin.post("/api/admin/gallery", json={**PHOTO, "caption": "x" * 141}).status_code == 422


def test_demo_reset(admin, db):
    assert admin.post("/api/admin/demo/reset").status_code == 404  # DEMO_MODE off
    settings.DEMO_MODE = True
    admin.put("/api/admin/services", json=[])
    admin.put("/api/admin/closures", json=["2026-10-12"])
    admin.post("/api/admin/bookings", json=admin_booking())
    r = admin.post("/api/admin/demo/reset")
    assert r.status_code == 200
    state = r.json()["state"]
    assert len(state["services"]) == 8 and len(state["barbers"]) == 2 and state["closures"] == []
    assert sorted(b["id"] for b in state["bookings"]) == [f"sample-b{i}" for i in range(9)]
    assert len(state["gallery"]) == 12 and len(state["messages"]) == 3
    assert all(x["sample"] is True for x in state["bookings"] + state["gallery"] + state["messages"])
    b0 = next(b for b in state["bookings"] if b["id"] == "sample-b0")
    assert (b0["date"], b0["time"], b0["name"]) == ("2026-09-25", 630, "Marcus Bell")
    m0 = next(m for m in state["messages"] if m["id"] == "sample-m0")
    assert r.json()["meta"]["now"]["epochMs"] - m0["createdAt"] == 40 * 60_000
    assert admin.get("/api/auth/me").status_code == 200  # still signed in
