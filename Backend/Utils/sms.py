"""Text messages through sms_outbox, sent with Twilio's REST API via httpx.

Nothing is sent inline from a request. Routes queue rows; the 5-second scheduler job
sends them. Confirm/decline/cancel wait 10 s, which outlasts the admin's 6-second undo
toast, and any later status change cancels them (validation.md V7).
Outbox timing uses the real UTC clock, not CROWN_CLOCK_OVERRIDE, so a frozen shop
clock cannot strand rows in the future.
"""

import logging
import re
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from config import settings
from db import SessionLocal
from shop import SHOP
from tables import Barber, Booking, Service, SmsOutbox
from Utils.clock import fmt_time, now_toronto, when_label

log = logging.getLogger("crown.sms")

GRACE_SECONDS = 10
MAX_ATTEMPTS = 3
CUSTOMER_KINDS = ("confirmed", "declined", "cancelled")


def normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    return None


def mask(e164: str) -> str:
    return e164[:5] + "***" + e164[-4:] if len(e164) > 9 else "***"


def queue(db: Session, kind: str, to_raw: str, body: str, booking_id: str | None = None,
          delay_seconds: int = 0, for_date: date | None = None) -> None:
    to = normalize_phone(to_raw)
    row = SmsOutbox(kind=kind, booking_id=booking_id, for_date=for_date, body=body,
                    to_phone=to or re.sub(r"\D", "", to_raw or ""),
                    send_after=datetime.now(timezone.utc) + timedelta(seconds=delay_seconds))
    if to is None:
        row.status, row.error = "failed", "bad_number"
    db.add(row)


def _parts(db: Session, b: Booking) -> tuple[str, str]:
    service = db.get(Service, b.service_id)
    barber = db.get(Barber, b.barber_id)
    service_name = service.name if service else "appointment"
    barber_name = barber.name if barber and barber.id != "any" else "the first available barber"
    return service_name, barber_name


def body_for(db: Session, kind: str, b: Booking) -> str:
    today = now_toronto().date()
    service, barber = _parts(db, b)
    when = when_label(b.date, b.time, today)
    phone = SHOP["phone_display"]
    if kind == "shop_new_request":
        return (f"Crown: new chair request. {b.name[:40]}, {service} with {barber}, {when}. "
                f"Confirm it in the admin: {settings.FRONTEND_ORIGIN}/admin/bookings")
    if kind == "confirmed":
        return (f"{SHOP['name']}: your chair is confirmed. {service} with {barber}, {when}. "
                f"{SHOP['street']}. Cash only. To change it, call {phone}.")
    if kind == "declined":
        return (f"{SHOP['name']}: sorry, we can't hold {when} for you. Walk-ins are always welcome, "
                f"or call {phone} to find another time.")
    if kind == "cancelled":
        return (f"{SHOP['name']}: sorry, your chair for {when} has been cancelled. Walk-ins are always "
                f"welcome, or call {phone} to find another time.")
    return (f"{SHOP['name']}: see you today at {fmt_time(b.time)} for your {service}. Cash only. "
            f"Running late or can't make it? Call {phone}.")


def queue_new_request(db: Session, b: Booking) -> None:
    if settings.CROWN_SHOP_SMS_TO:
        queue(db, "shop_new_request", settings.CROWN_SHOP_SMS_TO, body_for(db, "shop_new_request", b), b.id)


def on_status_change(db: Session, b: Booking, old: str, new: str) -> None:
    """Call after an admin PATCH changed b.status from old to new (same transaction)."""
    # Any later change (undo included) cancels a customer text still in its grace window.
    db.execute(update(SmsOutbox)
               .where(SmsOutbox.booking_id == b.id, SmsOutbox.status == "pending",
                      SmsOutbox.kind.in_(CUSTOMER_KINDS))
               .values(status="cancelled", error="superseded"))
    if b.source != "online":
        return
    kind = {("requested", "confirmed"): "confirmed",
            ("requested", "cancelled"): "declined",
            ("confirmed", "cancelled"): "cancelled"}.get((old, new))
    if kind:
        queue(db, kind, b.phone, body_for(db, kind, b), b.id, delay_seconds=GRACE_SECONDS)


def queue_reminders() -> int:
    """09:00 Toronto cron: one reminder per confirmed booking today. The partial unique
    index makes a second run (or a second worker) a no-op."""
    with SessionLocal() as db:
        today = now_toronto().date()
        rows = db.scalars(select(Booking).where(Booking.date == today, Booking.status == "confirmed",
                                                Booking.phone != "", Booking.sample.is_(False))).all()
        queued = 0
        for b in rows:
            to = normalize_phone(b.phone)
            if to is None:
                continue
            result = db.execute(
                insert(SmsOutbox)
                .values(booking_id=b.id, kind="reminder", for_date=today, to_phone=to,
                        body=body_for(db, "reminder", b))
                .on_conflict_do_nothing(index_elements=["booking_id", "for_date"],
                                        index_where=SmsOutbox.kind == "reminder"))
            queued += result.rowcount
        db.commit()
        return queued


def _send_twilio(to: str, body: str) -> str:
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    resp = httpx.post(url, auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                      data={"To": to, "From": settings.TWILIO_FROM_NUMBER, "Body": body}, timeout=10)
    resp.raise_for_status()
    return resp.json()["sid"]


def process_outbox(now: datetime | None = None) -> int:
    """Send due rows. SKIP LOCKED lets overlapping runs (or two processes) split the work
    instead of double-sending. Returns the number of rows handled."""
    now = now or datetime.now(timezone.utc)
    with SessionLocal() as db:
        rows = db.scalars(select(SmsOutbox)
                          .where(SmsOutbox.status == "pending", SmsOutbox.send_after <= now)
                          .order_by(SmsOutbox.send_after).limit(20)
                          .with_for_update(skip_locked=True)).all()
        for row in rows:
            b = db.get(Booking, row.booking_id) if row.booking_id else None
            if b is not None and b.sample:
                row.status, row.error = "cancelled", "sample"
                continue
            if row.kind == "reminder" and (b is None or b.status != "confirmed"):
                row.status, row.error = "cancelled", "not_confirmed"
                continue
            if settings.sms_dry_run:
                log.info('SMS DRY RUN kind=%s to=%s body="%s"', row.kind, mask(row.to_phone), row.body)
                row.status, row.sent_at = "dry_run", now
                continue
            try:
                row.provider_sid = _send_twilio(row.to_phone, row.body)
                row.status, row.sent_at, row.error = "sent", now, None
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                row.attempts += 1
                row.error = str(exc)[:500]
                if row.attempts >= MAX_ATTEMPTS:
                    row.status = "failed"
                else:
                    row.send_after = now + timedelta(minutes=1)
                log.warning("SMS send failed id=%s attempt=%s: %s", row.id, row.attempts, row.error)
        db.commit()
        return len(rows)
