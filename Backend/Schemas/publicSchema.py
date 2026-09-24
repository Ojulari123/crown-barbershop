from datetime import date

from Schemas.base import CamelModel


# Client-supplied id/createdAt/status/source/sample are not fields, so they are ignored.
class PublicBookingRequest(CamelModel):
    service_id: str
    barber_id: str
    date: date
    time: int
    name: str
    phone: str
    note: str = ""


class PublicMessageRequest(CamelModel):
    name: str
    phone: str
    body: str
