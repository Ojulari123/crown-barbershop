"""Toronto shop time. Every "now" in shop logic goes through now_toronto() (api-contract.md 7)."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from config import settings

TZ = ZoneInfo("America/Toronto")
BOOK_AHEAD_DAYS = 60


def now_toronto() -> datetime:
    # Fidelity runs freeze the browser clock; the override keeps server validation and
    # seed offsets on the same instant. Never honoured in production.
    if settings.CROWN_CLOCK_OVERRIDE and settings.ENV != "production":
        return datetime.fromisoformat(settings.CROWN_CLOCK_OVERRIDE).astimezone(TZ)
    return datetime.now(TZ)


def minutes_of(dt: datetime) -> int:
    return dt.hour * 60 + dt.minute


def dow(d: date) -> int:
    """0 = Sunday, matching the design's dayOfYmd and HOURS index."""
    return (d.weekday() + 1) % 7


EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


# Integer arithmetic, not float timestamps: createdAt must round-trip to the exact ms.
def epoch_ms(dt: datetime) -> int:
    return (dt - EPOCH) // timedelta(milliseconds=1)


def from_epoch_ms(ms: int) -> datetime:
    return EPOCH + timedelta(milliseconds=ms)


def fmt_time(mins: int) -> str:
    """Same as the design's fmtTime: '10 AM', '10:30 AM'."""
    h, m = divmod(mins, 60)
    suffix = "PM" if h >= 12 else "AM"
    h12 = 12 if h % 12 == 0 else h % 12
    return f"{h12} {suffix}" if m == 0 else f"{h12}:{m:02d} {suffix}"


def when_label(d: date, mins: int, today: date) -> str:
    """Same as Booking.tsx whenLabel: 'Today at 10 AM', 'Fri, Sep 25 at 10:30 AM'."""
    if d == today:
        day = "Today"
    elif d == today + timedelta(days=1):
        day = "Tomorrow"
    else:
        day = f"{d:%a}, {d:%b} {d.day}"
    return f"{day} at {fmt_time(mins)}"
