import logging
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from config import settings
from conftest import admin_booking, booking_body
from tables import Booking, SmsOutbox
from Utils import sms


def rows(db):
    db.expire_all()
    return db.scalars(select(SmsOutbox).order_by(SmsOutbox.id)).all()


def later(seconds=11):
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


@pytest.fixture
def online(client):
    """A real online request for Tania, Friday 11 AM."""
    assert client.post("/api/public/bookings", json=booking_body()).status_code == 201


def booking_id(db):
    return db.scalar(select(Booking.id))


def test_confirm_waits_for_grace_then_dry_runs(admin, db, online, caplog):
    bid = booking_id(db)
    assert admin.patch(f"/api/admin/bookings/{bid}", json={"status": "confirmed"}).status_code == 200
    [row] = rows(db)
    assert (row.kind, row.status, row.to_phone) == ("confirmed", "pending", "+15195550100")
    assert row.body == ("Crown Barber Shop: your chair is confirmed. Skin fade with Tania, Today at 11 AM. "
                        "219 Silvercreek Pkwy N. Cash only. To change it, call (519) 763-2229.")
    assert sms.process_outbox() == 0  # still inside the 10 s undo grace
    with caplog.at_level(logging.INFO, logger="crown.sms"):
        assert sms.process_outbox(later()) == 1
    assert rows(db)[0].status == "dry_run"
    assert 'SMS DRY RUN kind=confirmed to=+1519***0100 body="Crown Barber Shop: your chair is confirmed.' in caplog.text


def test_undo_inside_grace_cancels(admin, db, online):
    bid = booking_id(db)
    admin.patch(f"/api/admin/bookings/{bid}", json={"status": "confirmed"})
    admin.patch(f"/api/admin/bookings/{bid}", json={"status": "requested"})  # the Undo toast
    assert [(r.kind, r.status) for r in rows(db)] == [("confirmed", "cancelled")]
    assert sms.process_outbox(later()) == 0


def test_decline_and_cancel_confirmed(admin, db, online):
    bid = booking_id(db)
    admin.patch(f"/api/admin/bookings/{bid}", json={"status": "cancelled"})
    [declined] = rows(db)
    assert declined.kind == "declined" and "sorry, we can't hold Today at 11 AM for you" in declined.body
    sms.process_outbox(later())
    # Re-open, confirm, then the shop cancels the confirmed booking: that texts too (Fable decision).
    admin.patch(f"/api/admin/bookings/{bid}", json={"status": "requested"})
    admin.patch(f"/api/admin/bookings/{bid}", json={"status": "confirmed"})
    sms.process_outbox(later())
    admin.patch(f"/api/admin/bookings/{bid}", json={"status": "cancelled"})
    sms.process_outbox(later())
    assert [(r.kind, r.status) for r in rows(db)] == [
        ("declined", "dry_run"), ("confirmed", "dry_run"), ("cancelled", "dry_run")]
    assert "your chair for Today at 11 AM has been cancelled" in rows(db)[-1].body


def test_no_text_for_phone_bookings_or_admin_creates(admin, db):
    admin.post("/api/admin/bookings", json=admin_booking(id="ph", status="requested", source="phone",
                                                         phone="5195550101", time=660))
    admin.patch("/api/admin/bookings/ph", json={"status": "confirmed"})
    assert rows(db) == []


def test_sample_bookings_never_send(admin, db):
    db.add(Booking(id="sample-b2", name="Daniel", phone="519-555-0112", service_id="fade", barber_id="tania",
                   date=date(2026, 9, 25), time=930, status="requested", source="online", sample=True))
    db.commit()
    admin.patch("/api/admin/bookings/sample-b2", json={"status": "confirmed"})
    sms.process_outbox(later())
    [row] = rows(db)
    assert (row.status, row.error) == ("cancelled", "sample")


def test_shop_new_request_sends_now(client, db):
    settings.CROWN_SHOP_SMS_TO = "5195550000"
    client.post("/api/public/bookings", json=booking_body())
    assert sms.process_outbox() == 1
    assert rows(db)[0].status == "dry_run"


def test_reminders_once_per_day_and_rechecked(db):
    for i, status in enumerate(("confirmed", "confirmed", "requested")):
        db.add(Booking(id=f"r{i}", name="R", phone="5195550100", service_id="fade", barber_id="tania",
                       date=date(2026, 9, 25), time=660 + 30 * i, status=status, source="online"))
    db.add(Booking(id="r-tomorrow", name="R", phone="5195550100", service_id="fade", barber_id="tania",
                   date=date(2026, 9, 26), time=600, status="confirmed", source="online"))
    db.commit()
    assert sms.queue_reminders() == 2
    assert sms.queue_reminders() == 0  # a second cron run or worker is a no-op
    db.get(Booking, "r1").status = "cancelled"
    db.commit()
    sms.process_outbox()
    got = {r.booking_id: (r.status, r.error) for r in rows(db)}
    assert got == {"r0": ("dry_run", None), "r1": ("cancelled", "not_confirmed")}
    assert rows(db)[0].body.startswith("Crown Barber Shop: see you today at 11 AM for your Skin fade.")


def test_demo_mode_forces_dry_run_even_with_twilio(admin, db, online, monkeypatch):
    settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_FROM_NUMBER = "AC1", "tok", "+15550000000"
    settings.DEMO_MODE = True
    monkeypatch.setattr(sms, "_send_twilio", lambda *a: pytest.fail("must not call Twilio in DEMO_MODE"))
    admin.patch(f"/api/admin/bookings/{booking_id(db)}", json={"status": "confirmed"})
    sms.process_outbox(later())
    assert rows(db)[0].status == "dry_run"


def test_twilio_send_and_retry(admin, db, online, monkeypatch):
    settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_FROM_NUMBER = "AC1", "tok", "+15550000000"
    calls = []

    class Resp:
        def __init__(self, ok): self.ok = ok
        def raise_for_status(self):
            if not self.ok:
                raise sms.httpx.HTTPStatusError("boom", request=None, response=None)
        def json(self): return {"sid": "SM123"}

    def fake_post(url, auth, data, timeout):
        calls.append((url, auth, data))
        return Resp(ok=len(calls) > 1)

    monkeypatch.setattr(sms.httpx, "post", fake_post)
    admin.patch(f"/api/admin/bookings/{booking_id(db)}", json={"status": "confirmed"})
    sms.process_outbox(later())
    row = rows(db)[0]
    assert (row.status, row.attempts) == ("pending", 1)  # backs off one minute
    sms.process_outbox(later(75))
    row = rows(db)[0]
    assert (row.status, row.provider_sid) == ("sent", "SM123")
    url, auth, data = calls[-1]
    assert url == "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json"
    assert auth == ("AC1", "tok") and data["To"] == "+15195550100" and data["From"] == "+15550000000"


def test_phone_normalization():
    assert sms.normalize_phone("(519) 555-0100") == "+15195550100"
    assert sms.normalize_phone("1-519-555-0100") == "+15195550100"
    assert sms.normalize_phone("555-0100") is None
