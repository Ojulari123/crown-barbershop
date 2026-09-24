import json
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, update

from tables import Booking, Closure, Message, Photo, Service, ShopSettings


def add_booking(db, id, day, time=660, status="confirmed", **over):
    db.add(Booking(id=id, name=over.pop("name", "Someone"), phone=over.pop("phone", "5195550111"),
                   note=over.pop("note", ""), service_id="fade", barber_id=over.pop("barber_id", "tania"),
                   date=day, time=time, status=status, source="online", **over))


def test_public_state_shape(client, db):
    db.execute(update(ShopSettings).values(notice_text="Closed Monday for Thanksgiving.", notice_until=date(2026, 10, 13)))
    db.add_all([Closure(day=date(2026, 9, 1)), Closure(day=date(2026, 10, 12))])
    db.add(Photo(id="p1", src="https://x.test/a.jpg", caption="c", style="fade", featured=True,
                 created_at=datetime(2026, 9, 1, tzinfo=timezone.utc), sample=True))
    db.commit()
    r = client.get("/api/public/state")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert list(body) == ["services", "barbers", "hours", "closures", "notice", "gallery", "bookings"]
    assert body["services"][0] == {"id": "classic", "name": "Classic cut",
                                   "detail": "Scissor or clipper, finished with a neck shave",
                                   "minutes": 30, "price": 31, "category": "cuts", "visible": True}
    assert body["barbers"][0] == {"id": "any", "name": "First available", "note": "Shortest wait"}
    assert list(body["barbers"][1]) == ["id", "name", "note", "role", "bio"]
    assert body["closures"] == ["2026-10-12"]  # past closures are not sent
    assert body["notice"] == {"text": "Closed Monday for Thanksgiving.", "until": "2026-10-13"}
    assert body["gallery"] == [{"id": "p1", "src": "https://x.test/a.jpg", "caption": "c", "style": "fade",
                                "featured": True, "createdAt": 1788220800000}]  # no `sample` publicly


def test_public_state_leaks_no_pii(client, db):
    today = date(2026, 9, 25)
    add_booking(db, "probe", today, name="Leak Probe", phone="5195550199", note="probe-note")
    add_booking(db, "gone", today, time=690, status="cancelled", name="Cancelled Person")
    add_booking(db, "far", today + timedelta(days=61), name="Far Future")
    add_booking(db, "old", today - timedelta(days=1), name="Yesterday Person")
    db.add(Message(id="m1", name="Msg Sender", phone="5195550177", body="secret message body"))
    db.execute(update(Service).where(Service.id == "head").values(visible=False))
    db.commit()
    raw = client.get("/api/public/state").text
    for needle in ("Leak Probe", "5195550199", "probe-note", "Cancelled Person", "Far Future",
                   "Yesterday Person", "Msg Sender", "secret message", '"head"', "probe", "online", "createdAt"):
        assert needle not in raw, needle
    assert json.loads(raw)["bookings"] == [
        {"date": "2026-09-25", "time": 660, "barberId": "tania", "status": "confirmed"}]


def test_requested_slot_is_normalized_to_confirmed(client, db):
    add_booking(db, "req", date(2026, 9, 26), time=600, status="requested")
    db.commit()
    assert client.get("/api/public/state").json()["bookings"][0]["status"] == "confirmed"


def test_message_created(client, db):
    r = client.post("/api/public/messages",
                    json={"name": " Carol Mitchell ", "phone": "519-555-0158", "body": "Is there a step?"})
    assert r.status_code == 201 and r.json() == {"ok": True}
    m = db.scalar(select(Message))
    assert (m.name, m.read, m.archived, m.sample) == ("Carol Mitchell", False, False, False)


def test_message_validation(client):
    cases = [({"name": "C", "phone": "5195550158", "body": "Hello there"}, "invalid_name"),
             ({"name": "Carol", "phone": "555-0158", "body": "Hello there"}, "invalid_phone"),
             ({"name": "Carol", "phone": "5195550158", "body": " hey "}, "invalid_body")]
    for body, code in cases:
        r = client.post("/api/public/messages", json=body)
        assert r.status_code == 422 and r.json()["detail"]["code"] == code


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}
