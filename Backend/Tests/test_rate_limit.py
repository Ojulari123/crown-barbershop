from config import settings
from conftest import booking_body
from Utils.rate_limit import limiter


def test_sixth_booking_post_in_a_minute_is_429(client):
    limiter.enabled = True
    bad = booking_body(name="A")  # 422s still count against the limit
    assert [client.post("/api/public/bookings", json=bad).status_code for _ in range(5)] == [422] * 5
    r = client.post("/api/public/bookings", json=bad)
    assert r.status_code == 429
    assert r.json() == {"detail": {"code": "rate_limited", "message": "Too many requests. Try again in a minute."}}


def test_forwarded_for_only_trusted_behind_proxy(client):
    limiter.enabled = True
    bad = booking_body(name="A")

    def burst(ip):
        return [client.post("/api/public/bookings", json=bad, headers={"X-Forwarded-For": f"{ip}, 10.0.0.1"}).status_code
                for _ in range(6)]

    # TRUST_PROXY off: the header is ignored, so everyone shares the socket address.
    assert burst("1.1.1.1")[-1] == 429
    assert burst("2.2.2.2")[0] == 429
    limiter.reset()
    settings.TRUST_PROXY = True
    assert burst("3.3.3.3")[-1] == 429
    other = client.post("/api/public/bookings", json=bad, headers={"X-Forwarded-For": "4.4.4.4"})
    assert other.status_code == 422  # a different visitor has their own bucket
