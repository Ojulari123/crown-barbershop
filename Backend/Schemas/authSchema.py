from Schemas.base import CamelModel


class LoginRequest(CamelModel):
    email: str
    password: str
    remember: bool = False
