"""Rows -> wire JSON, byte-compatible with the design's TS types.

Admin screens dirty-check with JSON.stringify (TeamAdmin.tsx:67, PricesAdmin.tsx:87,
HoursAdmin.tsx:75), so keys follow TS declaration order, NULL optionals are omitted
(never null), and whole prices are integers (validation.md V4). Plain dicts keep that
order explicit instead of trusting a model's field order.
"""

from decimal import Decimal

from tables import Barber, Booking, Message, Photo, Service, ShopSettings
from Utils.clock import epoch_ms


def price(value: Decimal) -> int | float:
    return int(value) if value == value.to_integral_value() else float(value)


def service(s: Service) -> dict:
    return {"id": s.id, "name": s.name, "detail": s.detail, "minutes": s.minutes,
            "price": price(s.price), "category": s.category, "visible": s.visible}


def barber(b: Barber) -> dict:
    out = {"id": b.id, "name": b.name, "note": b.note}
    for key in ("role", "bio", "specialties", "photo"):
        value = getattr(b, key)
        if value is not None:
            out[key] = value
    return out


def photo(p: Photo, public: bool = False) -> dict:
    out = {"id": p.id, "src": p.src, "caption": p.caption, "style": p.style,
           "featured": p.featured, "createdAt": epoch_ms(p.created_at)}
    # `sample` only when true, and never on the public site (api-contract.md 3.1).
    if p.sample and not public:
        out["sample"] = True
    return out


def booking(b: Booking) -> dict:
    out = {"id": b.id, "createdAt": epoch_ms(b.created_at), "name": b.name, "phone": b.phone,
           "note": b.note, "serviceId": b.service_id, "barberId": b.barber_id,
           "date": b.date.isoformat(), "time": b.time, "status": b.status, "source": b.source}
    if b.sample:
        out["sample"] = True
    return out


def public_slot(b: Booking) -> dict:
    # Redacted: no id, name, phone, note, service or source ever leaves the server publicly.
    return {"date": b.date.isoformat(), "time": b.time, "barberId": b.barber_id, "status": "confirmed"}


def message(m: Message) -> dict:
    out = {"id": m.id, "createdAt": epoch_ms(m.created_at), "name": m.name, "phone": m.phone,
           "body": m.body, "read": m.read, "archived": m.archived}
    if m.sample:
        out["sample"] = True
    return out


def notice(s: ShopSettings) -> dict | None:
    if s.notice_text is None:
        return None
    return {"text": s.notice_text, "until": s.notice_until.isoformat() if s.notice_until else None}
