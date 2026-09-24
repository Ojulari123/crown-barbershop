#!/usr/bin/env python3
"""Seed the shop facts and the owner account; with --demo, the design's sample data too.

    python seed.py                         # services, barbers, hours, owner (only if missing)
    python seed.py --demo                  # + 12 photos, 9 bookings, 3 messages (sample=true)
    python seed.py --demo --now 2026-09-25T10:15:00-04:00   # fidelity runs

--today sets the sample booking dates, --now the createdAt offsets (validation.md V9).
Both default to now_toronto(), so CROWN_CLOCK_OVERRIDE is honoured too.
Re-running is safe: defaults and the owner are inserted only when missing, and the
sample rows are replaced by id.
"""

import argparse
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

import shop
from config import settings
from db import SessionLocal
from tables import Barber, Booking, Message, Photo, Service, ShopSettings, Staff
from Utils.clock import TZ, now_toronto
from Utils.security import hash_password

# The design's public demo account (Login.tsx:9-13); only acceptable with DEMO_MODE=1.
DEMO_OWNER = ("owner@crownbarbershop.ca", "crown2026", "Crown owner")


def service_rows() -> list[dict]:
    return [{**s, "price": Decimal(s["price"]), "visible": True, "position": i}
            for i, s in enumerate(shop.SERVICES)]


def barber_rows() -> list[dict]:
    return [{"role": None, "bio": None, "specialties": None, "photo": None, **b, "position": i}
            for i, b in enumerate(shop.BARBERS)]


def seed_defaults(db: Session) -> None:
    db.execute(insert(Service).values(service_rows()).on_conflict_do_nothing())
    db.execute(insert(Barber).values(barber_rows()).on_conflict_do_nothing())
    db.execute(insert(ShopSettings).values(id=1, hours=shop.HOURS).on_conflict_do_nothing())


def restore_defaults(db: Session) -> None:
    """Demo reset: services, barbers and hours back to the design exactly."""
    db.execute(delete(Service))
    db.execute(delete(Barber))
    db.execute(insert(Service).values(service_rows()))
    db.execute(insert(Barber).values(barber_rows()))
    db.execute(insert(ShopSettings).values(id=1, hours=shop.HOURS)
               .on_conflict_do_update(index_elements=["id"],
                                      set_={"hours": shop.HOURS, "notice_text": None, "notice_until": None}))


def seed_owner(db: Session, demo: bool) -> str:
    email, password, name = (settings.CROWN_OWNER_EMAIL, settings.CROWN_OWNER_PASSWORD, settings.CROWN_OWNER_NAME)
    if not (email and password):
        if not demo:
            # Deploys run seed.py on every start; once an owner exists the variables are optional.
            if db.scalar(select(Staff.id).where(Staff.role == "owner").limit(1)) is not None:
                return "owner account exists (CROWN_OWNER_EMAIL/PASSWORD not set, nothing to create)"
            sys.exit("Set CROWN_OWNER_EMAIL and CROWN_OWNER_PASSWORD, or pass --demo for the demo account.")
        email, password, name = DEMO_OWNER
    email = email.strip().lower()
    if db.scalar(select(Staff).where(Staff.email == email)) is None:
        db.add(Staff(email=email, name=name or "Crown owner", role="owner", password_hash=hash_password(password)))
        return f"created owner {email}"
    return f"owner {email} already exists (password unchanged)"


def seed_samples(db: Session, today: date, now: datetime) -> None:
    """The design's samplePhotos / sampleBookings / sampleMessages, ids and offsets exact."""
    photos = [{"id": f"sample-{i}", "src": shop.SAMPLE_PHOTO_URL.format(pid), "caption": caption,
               "style": style, "featured": featured, "created_at": now - timedelta(days=3 * i), "sample": True}
              for i, (pid, caption, style, featured) in enumerate(shop.SAMPLE_PHOTOS)]
    note_index, note = shop.SAMPLE_BOOKING_NOTE
    bookings = [{"id": f"sample-b{i}", "created_at": now - timedelta(hours=i + 1), "name": name, "phone": phone,
                 "note": note if i == note_index else "", "service_id": service_id, "barber_id": barber_id,
                 "date": today + timedelta(days=d), "time": time, "status": status, "source": source,
                 "sample": True}
                for i, (d, time, name, service_id, barber_id, phone, status, source)
                in enumerate(shop.SAMPLE_BOOKINGS)]
    messages = [{"id": f"sample-m{i}", "created_at": now - timedelta(minutes=ago), "name": name, "phone": phone,
                 "body": body, "read": read, "archived": False, "sample": True}
                for i, (ago, name, phone, body, read) in enumerate(shop.SAMPLE_MESSAGES)]
    for model, rows in ((Photo, photos), (Booking, bookings), (Message, messages)):
        db.execute(delete(model).where(model.id.in_([r["id"] for r in rows])))
        db.execute(insert(model).values(rows))


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Crown Barber Shop data")
    parser.add_argument("--demo", action="store_true", help="also seed the design's sample data")
    parser.add_argument("--today", type=date.fromisoformat, help="YYYY-MM-DD for sample booking dates")
    parser.add_argument("--now", type=datetime.fromisoformat, help="ISO instant for createdAt offsets")
    args = parser.parse_args()

    now = args.now.astimezone(TZ) if args.now else now_toronto()
    today = args.today or now.date()
    with SessionLocal() as db:
        seed_defaults(db)
        print(seed_owner(db, args.demo))
        if args.demo:
            seed_samples(db, today, now)
            print(f"seeded demo samples for today={today} now={now.isoformat()}")
        db.commit()
    print("seed done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
