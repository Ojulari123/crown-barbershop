import datetime as dt
from decimal import Decimal
from typing import Any, Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from Schemas.base import ID_PATTERN, CamelModel

BookingStatus = Literal["requested", "confirmed", "done", "cancelled", "no-show"]
BookingSource = Literal["online", "phone", "walk-in"]
CutStyle = Literal["fade", "classic", "beard", "kids", "shave"]


def _non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


class ServiceIn(CamelModel):
    id: str = Field(pattern=ID_PATTERN)
    name: str
    detail: str = ""
    minutes: int = Field(ge=5, le=240)
    price: Decimal = Field(ge=0, le=999, decimal_places=2)
    category: Literal["cuts", "shaves"]
    visible: bool = True

    _name = field_validator("name")(_non_blank)


class BarberIn(CamelModel):
    id: str = Field(pattern=ID_PATTERN)
    name: str
    note: str = ""
    # Omitted -> NULL, and '' / [] are kept as sent: TeamAdmin tells them apart.
    role: str | None = None
    bio: str | None = None
    specialties: list[str] | None = Field(default=None, max_length=8)
    photo: str | None = None

    _name = field_validator("name")(_non_blank)

    @field_validator("specialties")
    @classmethod
    def _short(cls, value):
        if value and any(len(s) > 40 for s in value):
            raise ValueError("each specialty is at most 40 characters")
        return value


class NoticeIn(CamelModel):
    text: str
    until: dt.date | None


class BookingIn(CamelModel):
    id: str = Field(pattern=ID_PATTERN)
    created_at: int
    name: str
    phone: str
    note: str = ""
    service_id: str
    barber_id: str
    date: dt.date
    time: int = Field(ge=0, le=1439)
    status: BookingStatus
    source: BookingSource


class BookingPatch(CamelModel):
    name: str | None = None
    phone: str | None = None
    note: str | None = None
    service_id: str | None = None
    barber_id: str | None = None
    date: dt.date | None = None
    time: int | None = Field(default=None, ge=0, le=1439)
    status: BookingStatus | None = None
    source: BookingSource | None = None
    # Present only so a client that sends them gets 422 immutable_field, not a silent ignore.
    id: Any = None
    created_at: Any = None
    sample: Any = None


class MessagePatch(CamelModel):
    model_config = ConfigDict(extra="forbid")
    read: bool | None = None
    archived: bool | None = None

    @model_validator(mode="after")
    def _one_key(self):
        if not self.model_fields_set or any(getattr(self, k) is None for k in self.model_fields_set):
            raise ValueError("send read and/or archived as booleans")
        return self


class PhotoIn(CamelModel):
    id: str = Field(pattern=ID_PATTERN)
    src: str
    caption: str = Field(default="", max_length=140)
    style: CutStyle
    featured: bool = False
    created_at: int


class PhotoPatch(CamelModel):
    caption: str | None = Field(default=None, max_length=140)
    style: CutStyle | None = None
    featured: bool | None = None
    created_at: int | None = None
