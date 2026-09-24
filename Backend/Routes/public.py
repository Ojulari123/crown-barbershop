import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db import get_db
from Schemas.publicSchema import PublicBookingRequest, PublicMessageRequest
from tables import Barber, Booking, Closure, Message, Photo, Service, ShopSettings
from Utils import wire
from Utils.clock import BOOK_AHEAD_DAYS, dow, minutes_of, now_toronto
from Utils.errors import fail
from Utils.rate_limit import limiter
from Utils.sms import queue_new_request

public_router = APIRouter()

SLOT_TAKEN = "Someone just took that time. Pick another one and try again."
# Same lead time as the site's slot grid (Booking.tsx:38).
LEAD_MINUTES = 20


def new_id() -> str:
    """Server id in the design's uid() alphabet (store.ts:86)."""
    return "".join(secrets.choice("0123456789abcdefghijklmnopqrstuvwxyz") for _ in range(12))


def valid_phone(phone: str) -> bool:
    return len(phone) <= 25 and len(re.sub(r"\D", "", phone)) >= 10


@public_router.get("/state")
@limiter.limit("120/minute")
def public_state(request: Request, response: Response, db: Session = Depends(get_db)):
    today = now_toronto().date()
    settings_row = db.get(ShopSettings, 1)
    slots = db.scalars(select(Booking).where(
        Booking.status != "cancelled", Booking.date >= today,
        Booking.date <= today + timedelta(days=BOOK_AHEAD_DAYS)).order_by(Booking.date, Booking.time)).all()
    response.headers["Cache-Control"] = "no-store"
    return {
        "services": [wire.service(s) for s in db.scalars(
            select(Service).where(Service.visible.is_(True)).order_by(Service.position))],
        "barbers": [wire.barber(b) for b in db.scalars(select(Barber).order_by(Barber.position))],
        "hours": settings_row.hours,
        "closures": [c.day.isoformat() for c in db.scalars(
            select(Closure).where(Closure.day >= today).order_by(Closure.day))],
        "notice": wire.notice(settings_row),
        "gallery": [wire.photo(p, public=True) for p in db.scalars(
            select(Photo).where(Photo.deleted_at.is_(None)).order_by(Photo.created_at.desc()))],
        "bookings": [wire.public_slot(b) for b in slots],
    }


@public_router.post("/bookings", status_code=201)
@limiter.limit("5/minute;20/hour")
def create_booking(request: Request, payload: PublicBookingRequest, db: Session = Depends(get_db)):
    name, phone, note = payload.name.strip(), payload.phone.strip(), payload.note.strip()
    if not 2 <= len(name) <= 80:
        raise fail(422, "invalid_name", "Enter a name between 2 and 80 characters.")
    if not valid_phone(phone):
        raise fail(422, "invalid_phone", "Enter a phone number with at least 10 digits.")
    if len(note) > 500:
        raise fail(422, "invalid_note", "Keep the note under 500 characters.")

    # Serialise every public booking for this day. There is no slot row to lock, and the
    # 'any' capacity rule is a count no unique index can express (schema.md section 2).
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": f"crown:day:{payload.date}"})

    service = db.get(Service, payload.service_id)
    if service is None or not service.visible:
        raise fail(422, "unknown_service", "That service is not offered.")
    barbers = db.scalars(select(Barber)).all()
    if payload.barber_id not in {b.id for b in barbers}:
        raise fail(422, "unknown_barber", "That barber is not available.")

    now = now_toronto()
    today = now.date()
    if not today <= payload.date <= today + timedelta(days=BOOK_AHEAD_DAYS):
        raise fail(422, "outside_window", "Pick a day within the next 60 days.")
    if db.get(Closure, payload.date) is not None:
        raise fail(422, "day_off", "The shop is closed that day.")
    ranges = db.get(ShopSettings, 1).hours[dow(payload.date)]
    grid = {m for a, b in ranges for m in range(a, b, 30) if m + service.minutes <= b}
    if payload.time not in grid:
        raise fail(422, "outside_hours", "That time is outside opening hours.")
    if payload.date == today and payload.time <= minutes_of(now) + LEAD_MINUTES:
        raise fail(422, "past_time", "That time has already passed. Pick a later one.")

    # isSlotTaken parity (store.ts:329): start times only; everything but cancelled counts.
    live, barber_busy = db.execute(
        select(func.count(), func.coalesce(func.bool_or(Booking.barber_id == payload.barber_id), False))
        .where(Booking.date == payload.date, Booking.time == payload.time, Booking.status != "cancelled")).one()
    real_barbers = max(1, sum(1 for b in barbers if b.id != "any"))
    if live >= real_barbers or (payload.barber_id != "any" and barber_busy):
        raise fail(409, "slot_taken", SLOT_TAKEN)

    booking = Booking(id=new_id(), created_at=now, name=name, phone=phone, note=note,
                      service_id=service.id, barber_id=payload.barber_id, date=payload.date,
                      time=payload.time, status="requested", source="online", sample=False)
    db.add(booking)
    try:
        db.flush()
    except IntegrityError:
        # An admin insert does not take the lock; the partial unique index still catches it.
        db.rollback()
        raise fail(409, "slot_taken", SLOT_TAKEN)
    queue_new_request(db, booking)
    db.commit()
    return {"slot": wire.public_slot(booking)}


@public_router.post("/messages", status_code=201)
@limiter.limit("5/minute;20/hour")
def create_message(request: Request, payload: PublicMessageRequest, db: Session = Depends(get_db)):
    name, phone, body = payload.name.strip(), payload.phone.strip(), payload.body.strip()
    if not 2 <= len(name) <= 80:
        raise fail(422, "invalid_name", "Enter a name between 2 and 80 characters.")
    if not valid_phone(phone):
        raise fail(422, "invalid_phone", "Enter a phone number with at least 10 digits.")
    if not 5 <= len(body) <= 1000:
        raise fail(422, "invalid_body", "Write a message between 5 and 1000 characters.")
    db.add(Message(id=new_id(), created_at=now_toronto(), name=name, phone=phone, body=body))
    db.commit()
    return {"ok": True}
