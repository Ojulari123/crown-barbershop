from config import settings
from Utils import media

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 2048
JPEG = b"\xff\xd8\xff\xe0" + b"\x01" * 4096


def upload(admin, data, kind="gallery", ctype="image/png"):
    return admin.post("/api/admin/uploads", files={"file": ("x.bin", data, ctype)}, data={"kind": kind})


def test_local_upload_served_and_counted(admin, client):
    r = upload(admin, JPEG, ctype="application/octet-stream")  # type comes from magic bytes
    assert r.status_code == 201
    url = r.json()["url"]
    assert url.startswith("/api/media/") and url.endswith(".jpg") and r.json()["bytes"] == len(JPEG)
    got = client.get(url)
    assert got.status_code == 200 and got.content == JPEG
    assert "immutable" in got.headers["cache-control"]
    # Counted only once a live photo references it.
    assert admin.get("/api/admin/state").json()["meta"]["mediaKb"] == 0
    admin.post("/api/admin/gallery", json={"id": "u1", "src": url, "caption": "", "style": "fade",
                                           "featured": False, "createdAt": 1})
    assert admin.get("/api/admin/state").json()["meta"]["mediaKb"] == 4
    assert upload(admin, JPEG).json()["url"] == url  # same bytes, same URL, no duplicate row


def test_upload_rejects_type_and_size(admin, monkeypatch):
    r = upload(admin, b"GIF89a" + b"\x00" * 100, ctype="image/png")
    assert r.status_code == 415 and r.json()["detail"]["code"] == "unsupported_type"
    monkeypatch.setattr(media, "MAX_BYTES", 1000)
    r = upload(admin, PNG)
    assert r.status_code == 413 and r.json()["detail"]["code"] == "too_large"
    assert upload(admin, PNG[:500], kind="banner").status_code == 422


def test_media_route_rejects_bad_names(client):
    assert client.get("/api/media/..%2F.env").status_code == 404
    assert client.get("/api/media/abcdefgh.gif").status_code == 404
    assert client.get("/api/media/abcdefgh1234.jpg").status_code == 404  # valid name, no file


def test_cloudinary_signed_upload(monkeypatch):
    settings.CROWN_CLOUDINARY_CLOUD_NAME, settings.CROWN_CLOUDINARY_API_KEY = "demo", "key"
    settings.CROWN_CLOUDINARY_API_SECRET = "shh"
    seen = {}

    class Resp:
        def raise_for_status(self): pass
        def json(self): return {"secure_url": "https://res.cloudinary.com/demo/crown/gallery/x.jpg",
                                "public_id": "crown/gallery/x"}

    def fake_post(url, data, files, timeout):
        seen.update(url=url, data=data)
        return Resp()

    monkeypatch.setattr(media.httpx, "post", fake_post)
    try:
        url, storage, key = media.store(JPEG, "jpg", "gallery")
    finally:
        settings.CROWN_CLOUDINARY_API_KEY = settings.CROWN_CLOUDINARY_API_SECRET = ""
    assert (url, storage, key) == ("https://res.cloudinary.com/demo/crown/gallery/x.jpg", "cloudinary", "crown/gallery/x")
    assert seen["url"] == "https://api.cloudinary.com/v1_1/demo/image/upload"
    assert seen["data"]["folder"] == "crown/gallery" and len(seen["data"]["signature"]) == 40
    assert "shh" not in str(seen["data"])  # the secret signs, it is never sent
