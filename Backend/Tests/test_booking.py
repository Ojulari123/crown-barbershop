import threading
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update

from config import settings
from conftest import admin_booking, booking_body
from main import app
from tables import Barber, Booking, Closure, Service, SmsOutbox


def post(client, **over):
    return client.post("/api/public/bookings", json=booking_body(**over))


def code(resp):
    return resp.json()["detail"]["code"]


def test_booking_created(client, db):
    settings.CROWN_SHOP_SMS_TO = "519-555-0000"
    r = post(client, id="evil", status="confirmed", source="phone", sample=True, name="  Test Client ")
    assert r.status_code == 201
    assert r.json() == {"slot": {"date": "2026-09-25", "time": 660, "barberId": "tania", "status": "confirmed"}}
    b = db.scalar(select(Booking))
    assert b.id != "evil" and len(b.id) == 12
    assert (b.name, b.status, b.source, b.sample) == ("Test Client", "requested", "online", False)
    sms = db.scalar(select(SmsOutbox))
    assert (sms.kind, sms.to_phone, sms.status) == ("shop_new_request", "+15195550000", "pending")
    assert "Test Client, Skin fade with Tania, Today at 11 AM" in sms.body


@pytest.mark.parametrize("over, expected", [
    ({"name": "A"}, "invalid_name"),
    ({"phone": "555-0100"}, "invalid_phone"),
    ({"phone": "1" * 26}, "invalid_phone"),
    ({"note": "x" * 501}, "invalid_note"),
    ({"serviceId": "nope"}, "unknown_service"),
    ({"barberId": "nope"}, "unknown_barber"),
    ({"date": "2026-09-24"}, "outside_window"),          # yesterday
    ({"date": "2026-11-25"}, "outside_window"),          # today + 61
    ({"date": "2026-09-27"}, "outside_hours"),           # Sunday: closed every week
    ({"time": 870}, "outside_hours"),                    # 2:30 PM lunch gap
    ({"time": 645}, "outside_hours"),                    # off the 30-minute grid
    ({"time": 1110}, "outside_hours"),                   # 40-min fade would end after 7 PM
    ({"time": 630}, "past_time"),                        # now is 10:15; 10:30 is inside the 20-min lead
    ({"time": 600}, "past_time"),
])
def test_booking_validation(client, over, expected):
    r = post(client, **over)
    assert r.status_code == 422 and code(r) == expected


def test_window_edge_is_bookable(client):
    assert post(client, date="2026-11-24", time=600).status_code == 201  # today + 60, a Tuesday


def test_closure_is_day_off(client, db):
    db.add(Closure(day=date(2026, 9, 26)))
    db.commit()
    r = post(client, date="2026-09-26", time=600)
    assert r.status_code == 422 and code(r) == "day_off"


def test_hidden_service_rejected(client, db):
    db.execute(update(Service).where(Service.id == "fade").values(visible=False))
    db.commit()
    assert code(post(client)) == "unknown_service"


def test_slot_taken_named_and_any(client):
    assert post(client).status_code == 201
    again = post(client)
    assert again.status_code == 409 and code(again) == "slot_taken"
    assert again.json()["detail"]["message"] == "Someone just took that time. Pick another one and try again."
    assert post(client, barberId="any").status_code == 409  # one real barber -> one chair


def test_done_and_no_show_still_count_but_cancelled_does_not(client, db):
    db.add(Booking(id="c1", name="X", phone="5195550100", service_id="fade", barber_id="tania",
                   date=date(2026, 9, 25), time=660, status="cancelled", source="online"))
    db.add(Booking(id="d1", name="X", phone="5195550100", service_id="fade", barber_id="any",
                   date=date(2026, 9, 25), time=690, status="done", source="online"))
    db.commit()
    assert post(client).status_code == 201
    assert post(client, time=690).status_code == 409


def test_admin_booking_blocks_public(admin, client):
    assert admin.post("/api/admin/bookings", json=admin_booking(time=660, status="confirmed",
                                                                source="phone", phone="5195550101")).status_code == 201
    assert post(client).status_code == 409


def _race(bodies):
    """Fire all bodies at once from separate threads; return status codes."""
    barrier = threading.Barrier(len(bodies))
    results = []

    def run(body):
        c = TestClient(app)
        barrier.wait()
        results.append(c.post("/api/public/bookings", json=body).status_code)

    threads = [threading.Thread(target=run, args=(b,)) for b in bodies]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return sorted(results)


def test_concurrent_same_slot_exactly_one_wins(db):
    codes = _race([booking_body(name=f"Racer {i}", barberId="tania" if i % 2 else "any") for i in range(8)])
    assert codes == [201] + [409] * 7
    assert db.scalar(select(func.count()).select_from(Booking)) == 1


def test_concurrent_any_capacity_two_barbers(db):
    db.add(Barber(id="sam", name="Sam", note="", position=2))
    db.commit()
    codes = _race([booking_body(name=f"Racer {i}", barberId="any") for i in range(6)])
    assert codes == [201, 201] + [409] * 4
