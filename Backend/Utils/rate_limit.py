from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter

from config import settings


def client_ip(request: Request) -> str:
    # Behind Vercel -> Render every request arrives from a proxy, so without this the
    # booking limit would be shared by the whole site (validation.md V8).
    if settings.TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for", "")
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=client_ip)


def rate_limited_handler(request: Request, exc) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": {"code": "rate_limited", "message": "Too many requests. Try again in a minute."}},
    )
