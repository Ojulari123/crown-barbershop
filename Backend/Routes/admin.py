from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Body, Depends, File, Form, Request, Response, UploadFile
from sqlalchemy import delete, func, select, union
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import seed
from config import settings
from db import get_db
from Routes.public import valid_phone
from Schemas.adminSchema import (BarberIn, BookingIn, BookingPatch, MessagePatch, NoticeIn, PhotoIn, PhotoPatch,
                                 ServiceIn)
from tables import Barber, Booking, Closure, Media, Message, Photo, Service, ShopSettings, SmsOutbox, Staff
from Utils import media, sms, wire
from Utils.clock import epoch_ms, from_epoch_ms, minutes_of, now_toronto
from Utils.errors import fail
from Utils.rate_limit import limiter
from Utils.security import get_current_staff, require_csrf

admin_router = APIRouter(dependencies=[Depends(require_csrf), Depends(get_current_staff)])


# ---------- state ----------

def media_kb(db: Session) -> int:
    referenced = union(select(Photo.src).where(Photo.deleted_at.is_(None)),
                       select(Barber.photo).where(Barber.photo.is_not(None)))
    total = db.scalar(select(func.coalesce(func.sum(Media.bytes), 0)).where(Media.url.in_(referenced)))
    return round(total / 1024)


def admin_state(db: Session) -> dict:
    settings_row = db.get(ShopSettings, 1)
    now = now_toronto()
    return {
        "state": {
            "services": [wire.service(s) for s in db.scalars(select(Service).order_by(Service.position))],
            "barbers": [wire.barber(b) for b in db.scalars(select(Barber).order_by(Barber.position))],
            "hours": settings_row.hours,
            "gallery": [wire.photo(p) for p in db.scalars(
                select(Photo).where(Photo.deleted_at.is_(None)).order_by(Photo.created_at.desc()))],
            # Every booking, every status and date: the CSV export is built from this (D15).
            "bookings": [wire.booking(b) for b in db.scalars(
                select(Booking).order_by(Booking.date, Booking.time, Booking.created_at))],
            "messages": [wire.message(m) for m in db.scalars(select(Message).order_by(Message.created_at.desc()))],
            "notice": wire.notice(settings_row),
            "closures": [c.day.isoformat() for c in db.scalars(select(Closure).order_by(Closure.day))],
        },
        "meta": {"mediaKb": media_kb(db), "demoMode": settings.DEMO_MODE,
                 "now": {"ymd": now.date().isoformat(), "minutes": minutes_of(now), "epochMs": epoch_ms(now)}},
    }


@admin_router.get("/state")
def get_state(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return admin_state(db)


# ---------- config slices: whole-slice PUT ----------

def unique_ids(items: list) -> None:
    if len({i.id for i in items}) != len(items):
        raise fail(422, "duplicate_id", "Every id in the list must be unique.")


def check_url(value: str, field: str) -> None:
    # The adapter uploads data: URLs first (api-contract.md 5); the server never stores them.
    if value.startswith("data:"):
        raise fail(422, "inline_image", f"Upload the image before saving the {field}.")
    if not (value.startswith("https://") or value.startswith("/api/media/")):
        raise fail(422, f"invalid_{field}", f"The {field} must be an https:// or /api/media/ URL.")


@admin_router.put("/services")
def put_services(payload: list[ServiceIn], db: Session = Depends(get_db)):
    unique_ids(payload)
    db.execute(delete(Service))
    db.add_all(Service(**s.model_dump(), position=i) for i, s in enumerate(payload))
    db.commit()
    return [wire.service(s) for s in db.scalars(select(Service).order_by(Service.position))]


@admin_router.put("/barbers")
def put_barbers(payload: list[BarberIn], db: Session = Depends(get_db)):
    unique_ids(payload)
    anys = [b for b in payload if b.id == "any"]
    if len(anys) != 1 or any(getattr(anys[0], k) is not None for k in ("role", "bio", "specialties", "photo")):
        raise fail(422, "any_required", "Keep exactly one 'First available' row, with only a name and note.")
    for b in payload:
        if b.photo is not None:
            check_url(b.photo, "photo")
    db.execute(delete(Barber))
    db.add_all(Barber(**b.model_dump(), position=i) for i, b in enumerate(payload))
    db.commit()
    return [wire.barber(b) for b in db.scalars(select(Barber).order_by(Barber.position))]


def valid_hours(hours) -> bool:
    """7 days of sorted, non-overlapping [open, close] minute pairs (HoursAdmin.toHours)."""
    if not isinstance(hours, list) or len(hours) != 7:
        return False
    for day in hours:
        if not isinstance(day, list):
            return False
        prev_close = -1
        for pair in day:
            if (not isinstance(pair, list) or len(pair) != 2
                    or not all(isinstance(v, int) and not isinstance(v, bool) for v in pair)):
                return False
            a, b = pair
            if not (0 <= a < b <= 1440) or a < prev_close:
                return False
            prev_close = b
    return True


@admin_router.put("/hours")
def put_hours(payload: list = Body(...), db: Session = Depends(get_db)):
    if not valid_hours(payload):
        raise fail(422, "invalid_hours", "Each day needs sorted, non-overlapping opening ranges.")
    db.get(ShopSettings, 1).hours = payload
    db.commit()
    return payload


@admin_router.put("/closures")
def put_closures(payload: list[date], db: Session = Depends(get_db)):
    days = sorted(set(payload))
    db.execute(delete(Closure))
    db.add_all(Closure(day=d) for d in days)
    db.commit()
    return [d.isoformat() for d in days]


@admin_router.put("/notice")
def put_notice(payload: NoticeIn, db: Session = Depends(get_db)):
    text = payload.text.strip()
    if not 5 <= len(text) <= 280:
        raise fail(422, "invalid_notice", "Write a notice between 5 and 280 characters.")
    row = db.get(ShopSettings, 1)
    row.notice_text, row.notice_until = text, payload.until
    db.commit()
    return wire.notice(row)


@admin_router.delete("/notice", status_code=204)
def delete_notice(db: Session = Depends(get_db)):
    row = db.get(ShopSettings, 1)
    row.notice_text = row.notice_until = None
    db.commit()
    return Response(status_code=204)


# ---------- bookings ----------
# Shape checks only: the admin form and walk-in flow already encode staff judgment, and
# walk-ins can fall outside hours (D17). The partial unique index is the only capacity rule.

def check_booking(db: Session, fields: dict, merged: dict) -> None:
    """Validate the changed `fields`; `merged` is the full row after the change."""
    if "name" in fields and not 1 <= len(fields["name"].strip()) <= 80:
        raise fail(422, "invalid_name", "Enter a name between 1 and 80 characters.")
    if "phone" in fields or "source" in fields:
        phone = merged["phone"]
        if not (phone == "" and merged["source"] == "walk-in") and not valid_phone(phone):
            raise fail(422, "invalid_phone", "Enter a phone number with at least 10 digits.")
    if "note" in fields and len(fields["note"]) > 500:
        raise fail(422, "invalid_note", "Keep the note under 500 characters.")
    # Hidden services are allowed: the admin form lists all of them.
    if "service_id" in fields and db.get(Service, fields["service_id"]) is None:
        raise fail(422, "unknown_service", "That service does not exist.")
    if "barber_id" in fields and db.get(Barber, fields["barber_id"]) is None:
        raise fail(422, "unknown_barber", "That barber does not exist.")


def flush_booking(db: Session, barber_id: str) -> None:
    """Flush now so a unique-index clash maps to 409 before any SMS is queued."""
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
        if constraint == "ux_bookings_live_barber_slot":
            barber = db.get(Barber, barber_id)
            raise fail(409, "slot_taken", f"{barber.name if barber else 'That barber'} already has a booking at that time.")
        if constraint == "bookings_pkey":
            raise fail(409, "duplicate_id", "A booking with that id already exists.")
        raise fail(422, "invalid", "That booking could not be saved.")


@admin_router.post("/bookings", status_code=201)
def create_booking(payload: BookingIn, db: Session = Depends(get_db)):
    fields = payload.model_dump()
    check_booking(db, fields, fields)
    if db.get(Booking, payload.id) is not None:
        raise fail(409, "duplicate_id", "A booking with that id already exists.")
    # No SMS: an admin-entered booking was arranged in person or by phone.
    booking = Booking(**{**fields, "created_at": from_epoch_ms(payload.created_at)}, sample=False)
    db.add(booking)
    flush_booking(db, booking.barber_id)
    db.commit()
    return wire.booking(booking)


@admin_router.patch("/bookings/{booking_id}")
def patch_booking(booking_id: str, payload: BookingPatch, db: Session = Depends(get_db)):
    changes = payload.model_dump(exclude_unset=True)
    if changes.keys() & {"id", "created_at", "sample"}:
        raise fail(422, "immutable_field", "id, createdAt and sample cannot be changed.")
    if any(v is None for v in changes.values()):
        raise fail(422, "invalid", "Fields cannot be null.")
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise fail(404, "not_found", "No such booking.")
    merged = {"phone": booking.phone, "source": booking.source, **changes}
    check_booking(db, changes, merged)
    old_status = booking.status
    for key, value in changes.items():
        setattr(booking, key, value)
    flush_booking(db, booking.barber_id)
    if booking.status != old_status:
        sms.on_status_change(db, booking, old_status, booking.status)
    db.commit()
    return wire.booking(booking)


# ---------- messages ----------

@admin_router.patch("/messages/{message_id}")
def patch_message(message_id: str, payload: MessagePatch, db: Session = Depends(get_db)):
    message = db.get(Message, message_id)
    if message is None:
        raise fail(404, "not_found", "No such message.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(message, key, value)
    db.commit()
    return wire.message(message)


# ---------- uploads and gallery ----------

@admin_router.post("/uploads", status_code=201)
@limiter.limit("60/minute")
def upload(request: Request, file: UploadFile = File(...),
           kind: Literal["gallery", "portrait"] = Form(...), db: Session = Depends(get_db)):
    data = file.file.read(media.MAX_BYTES + 1)
    if len(data) > media.MAX_BYTES:
        raise fail(413, "too_large", "Images must be 5 MB or smaller.")
    ext = media.sniff_ext(data)
    if ext is None:
        raise fail(415, "unsupported_type", "Upload a JPEG, PNG or WebP image.")
    url, storage, key = media.store(data, ext, kind)
    # Same bytes -> same content-hash URL, so a repeat upload reuses the row.
    db.execute(insert(Media).values(url=url, storage=storage, storage_key=key, kind=kind, bytes=len(data))
               .on_conflict_do_nothing(index_elements=["url"]))
    db.commit()
    return {"url": url, "bytes": len(data)}


def live_photo(db: Session, photo_id: str) -> Photo:
    photo = db.get(Photo, photo_id)
    if photo is None or photo.deleted_at is not None:
        raise fail(404, "not_found", "No such photo.")
    return photo


@admin_router.post("/gallery", status_code=201)
def create_photo(payload: PhotoIn, response: Response, db: Session = Depends(get_db)):
    check_url(payload.src, "src")
    photo = db.get(Photo, payload.id)
    if photo is not None and photo.deleted_at is None:
        raise fail(409, "duplicate_id", "A photo with that id already exists.")
    if photo is not None:
        # Undo of a delete: restore the row, keeping its stored `sample` flag (D11).
        photo.deleted_at = None
        response.status_code = 200
    else:
        photo = Photo(id=payload.id, src=payload.src, sample=False)
        db.add(photo)
    photo.caption, photo.style, photo.featured = payload.caption, payload.style, payload.featured
    photo.created_at = from_epoch_ms(payload.created_at)
    db.commit()
    return wire.photo(photo)


@admin_router.patch("/gallery/{photo_id}")
def patch_photo(photo_id: str, payload: PhotoPatch, db: Session = Depends(get_db)):
    changes = payload.model_dump(exclude_unset=True)
    if any(v is None for v in changes.values()):
        raise fail(422, "invalid", "Fields cannot be null.")
    photo = live_photo(db, photo_id)
    if "created_at" in changes:
        # Reorder swaps two photos' createdAt (GalleryAdmin.tsx:103-111).
        changes["created_at"] = from_epoch_ms(changes["created_at"])
    for key, value in changes.items():
        setattr(photo, key, value)
    db.commit()
    return wire.photo(photo)


@admin_router.delete("/gallery/{photo_id}", status_code=204)
def delete_photo(photo_id: str, db: Session = Depends(get_db)):
    # Soft delete and keep the file, so undo (a POST with the same id) restores it.
    live_photo(db, photo_id).deleted_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=204)


# ---------- demo ----------

@admin_router.post("/demo/reset")
@limiter.limit("5/minute")
def demo_reset(request: Request, staff: Staff = Depends(get_current_staff), db: Session = Depends(get_db)):
    if not settings.DEMO_MODE:
        raise fail(404, "not_found", "Not found.")
    if staff.role != "owner":
        raise fail(403, "forbidden", "Only the owner can reset the demo.")
    for model in (Booking, Message, Photo, Closure):
        db.execute(delete(model))
    db.execute(delete(SmsOutbox).where(SmsOutbox.status == "pending"))
    seed.restore_defaults(db)
    now = now_toronto()
    seed.seed_samples(db, now.date(), now)
    db.commit()
    return admin_state(db)
