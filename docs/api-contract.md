# Crown Barber Shop: API contract (v1)

Owner: E1. Implemented by E2 (`Backend/`), consumed by E3/E4 through `src/lib/store.ts` (adapter) and `src/lib/api.ts`.
Source of truth for types: `store.ts` and `data.ts` in the design (`web-edit/src/components/generated/`, identical copies in `admin-ctx`). Line references are to those files.

Related docs: `schema.md` (tables), `callsites.md` (every component call mapped to an endpoint), `decisions.md`, `validation.md`.

---

## 0. Conventions

| Topic | Rule |
|---|---|
| Base path | Every route lives under `/api`. The browser only ever calls same-origin `/api/*`; Next rewrites it to `API_ORIGIN`. Server components in Next call `API_ORIGIN` directly. |
| Casing | camelCase on the wire, exactly the TS field names. snake_case only in SQL. Pydantic models use `alias_generator=to_camel`, `populate_by_name=True`. |
| Field order | Response objects list keys **in the same order as the TS type** and **omit** optional keys whose DB value is NULL (`model_dump(by_alias=True, exclude_none=True)`). Admin screens compare `JSON.stringify` of server data against local drafts (`TeamAdmin.tsx:67`, `PricesAdmin.tsx:87`, `HoursAdmin.tsx:75`), so key order and missing-vs-null matter. See validation.md V4. |
| Numbers | `price` is serialized as an integer when whole (`34`, not `34.0`), else a number with up to 2 decimals. `time` and `minutes` are integers. `createdAt` is epoch milliseconds (integer, UTC). |
| Dates | `date`, `until`, closures: `YYYY-MM-DD` strings, Toronto calendar dates. Never a timestamp. |
| Errors (app) | `{"detail": {"code": "<snake_case>", "message": "<human text>"}}` with the status codes listed per endpoint. |
| Errors (validation) | FastAPI default 422 `{"detail": [ ...pydantic errors ]}`. The adapter treats any 422 as `reason: 'invalid'`. |
| Auth | httpOnly cookies (section 2). No `Authorization` header, no token in JS, no localStorage. |
| CSRF | Cookies are `SameSite=Lax`. In addition every non-GET request to `/api/auth/*` and `/api/admin/*` must send header `X-Crown: 1`; the server returns 403 `csrf` without it. A custom header forces a CORS preflight for any cross-site caller, and CORS allows only `FRONTEND_ORIGIN`. |
| Rate limits | slowapi, in-memory (single Render instance). Handler signature puts `request: Request` first; route decorator above `@limiter.limit(...)` (Housing `Routes/viewing.py:194-196`). Key function: client IP from the first `X-Forwarded-For` hop when `TRUST_PROXY=1`, else `request.client.host`. 429 body: `{"detail": {"code": "rate_limited", "message": "Too many requests. Try again in a minute."}}` |
| Caching | `GET /api/public/state` and `GET /api/admin/state` send `Cache-Control: no-store`. |
| Clock | All "now" logic goes through `Utils/clock.py: now_toronto()`. When `CROWN_CLOCK_OVERRIDE` is set (ISO 8601 with offset) and `ENV != "production"`, that instant is used instead (fidelity and tests). See section 7. |

### Wire types (copied from the design, do not change)

```ts
// data.ts:36
type Service = { id: string; name: string; detail: string; minutes: number; price: number;
                 category: 'cuts' | 'shaves'; visible?: boolean };
// data.ts:58
type Barber = { id: string; name: string; note: string; role?: string; bio?: string;
                specialties?: string[]; photo?: string };
// store.ts:28
type Photo = { id: string; src: string; caption: string; style: 'fade'|'classic'|'beard'|'kids'|'shave';
               featured: boolean; createdAt: number; sample?: boolean };
// store.ts:38-52
type BookingStatus = 'requested' | 'confirmed' | 'done' | 'cancelled' | 'no-show';
type Booking = { id: string; createdAt: number; name: string; phone: string; note: string;
                 serviceId: string; barberId: string; date: string; time: number;
                 status: BookingStatus; source: 'online' | 'phone' | 'walk-in'; sample?: boolean };
// store.ts:54
type Message = { id: string; createdAt: number; name: string; phone: string; body: string;
                 read: boolean; archived: boolean; sample?: boolean };
// store.ts:65-66
type Notice = { text: string; until: string | null } | null;
type Hours = [number, number][][];          // 7 entries, index 0 = Sunday, minutes after midnight
// store.ts:68
type CrownState = { services; barbers; hours; gallery; bookings; messages; notice; closures: string[] };
```

`sample` is emitted only when `true` (it is omitted for real rows, matching the design where real rows never carry the key).

New wire types introduced by this contract:

```ts
type Session = { email: string; name: string; role: 'owner' | 'staff' };   // superset of Login.tsx:14 Session
type PublicSlot = { date: string; time: number; barberId: string; status: 'confirmed' };
type AdminMeta = { mediaKb: number; demoMode: boolean; now: { ymd: string; minutes: number; epochMs: number } };
```

---

## 1. Endpoint index

| # | Method + path | Auth | Rate limit | Used by (see callsites.md) |
|---|---|---|---|---|
| 1 | `GET /api/health` | none | none | Render health check |
| 2 | `GET /api/public/state` | none | `120/minute` | site hydration: all 11 site `useCrown()` reads |
| 3 | `POST /api/public/bookings` | none | `5/minute;20/hour` | `Booking.tsx:166` |
| 4 | `POST /api/public/messages` | none | `5/minute;20/hour` | `Visit.tsx:185` |
| 5 | `GET /api/media/{name}` | none | none | local media (only when Cloudinary is not configured) |
| 6 | `POST /api/auth/login` | none | `10/minute` | `Login.tsx:18` `signIn()` |
| 7 | `POST /api/auth/refresh` | refresh cookie | `30/minute` | adapter, on any 401 |
| 8 | `POST /api/auth/logout` | refresh cookie | none | `CrownShopAdmin.tsx:97-101` sign-out |
| 9 | `GET /api/auth/me` | access cookie | none | `CrownShopAdmin.tsx:71` `readSession()` replacement |
| 10 | `GET /api/admin/state` | staff | none | admin hydration + 30 s poll: all 14 admin `useCrown()` reads |
| 11 | `PUT /api/admin/services` | staff | none | `PricesAdmin.tsx:109` |
| 12 | `PUT /api/admin/barbers` | staff | none | `TeamAdmin.tsx:82` |
| 13 | `PUT /api/admin/hours` | staff | none | `HoursAdmin.tsx:93` |
| 14 | `PUT /api/admin/closures` | staff | none | `HoursAdmin.tsx:254`, `:266` |
| 15 | `PUT /api/admin/notice` | staff | none | `HoursAdmin.tsx:186`, `:201` |
| 16 | `DELETE /api/admin/notice` | staff | none | `HoursAdmin.tsx:196`, `:201` (undo to null) |
| 17 | `POST /api/admin/bookings` | staff | none | `Bookings.tsx:240`, `Today.tsx:365` |
| 18 | `PATCH /api/admin/bookings/{id}` | staff | none | `Bookings.tsx:24`, `:37`, `:232` |
| 19 | `PATCH /api/admin/messages/{id}` | staff | none | `Messages.tsx:18` |
| 20 | `POST /api/admin/uploads` | staff | `60/minute` | adapter, before 21 / 12 when a `src`/`photo` is a `data:` URL |
| 21 | `POST /api/admin/gallery` | staff | none | `GalleryAdmin.tsx:75`, `:96`, `:238` |
| 22 | `PATCH /api/admin/gallery/{id}` | staff | none | `GalleryAdmin.tsx:42`, `:103` |
| 23 | `DELETE /api/admin/gallery/{id}` | staff | none | `GalleryAdmin.tsx:93`, `:235` |
| 24 | `POST /api/admin/demo/reset` | owner | `5/minute` | `SettingsAdmin.tsx:64` `resetDemo()` (DEMO_MODE only) |

Nothing else is reachable from the design. Diffs the design cannot produce (deleting a booking, creating or deleting a message from the admin) have **no endpoint**; the adapter logs `console.error` and resyncs if it ever sees one (section 8.4).

---

## 2. Auth

### Cookies

| Cookie | Content | Flags | Lifetime |
|---|---|---|---|
| `crown_access` | JWT HS256, claims `{sub: staffId, role, tv: tokenVersion, exp}` | `HttpOnly; SameSite=Lax; Path=/; Secure` (Secure when `COOKIE_SECURE=1`) | `Max-Age=3600` (ACCESS_TOKEN_EXPIRE_MINUTES=60) |
| `crown_refresh` | opaque `secrets.token_urlsafe(64)`; DB stores SHA-256 only | `HttpOnly; SameSite=Lax; Path=/api/auth; Secure` | `Max-Age=REFRESH_TOKEN_EXPIRE_DAYS*86400` (30 d) when `remember=true`, else a session cookie (no Max-Age). DB expiry is 30 d either way. |
| `crown_signed_in` | literal `1` | `SameSite=Lax; Path=/` (not HttpOnly; carries no secret) | same as `crown_refresh` |

`crown_signed_in` exists only so the Next middleware on `/admin/*` can decide "show login or not" without seeing the httpOnly tokens. It grants nothing; every admin API call is still checked server-side.

Rotation and reuse detection follow Housing `Utils/security.py:440-537`: presenting a revoked refresh token revokes the whole `family_id`, except the one-hop, 30-second lost-response grace (`REFRESH_ROTATION_GRACE_SECONDS = 30`, `_is_lost_response_retry`). `token_version` in the JWT (`tv`) is compared on every request (Housing `_check_token_version`).

### 2.1 `POST /api/auth/login`
Request:
```json
{ "email": "owner@crownbarbershop.ca", "password": "crown2026", "remember": true }
```
- `email` trimmed and lowercased before lookup (matches `Login.tsx:19`). 
- 200 → `Session` body + the three cookies:
```json
{ "email": "owner@crownbarbershop.ca", "name": "Crown owner", "role": "owner" }
```
- 401 `invalid_credentials`, message `"That email and password do not match."` (same response for unknown email and wrong password; bcrypt verify still runs against a dummy hash for unknown emails).
- 422 malformed body. 429 rate limited. 403 `csrf` without `X-Crown: 1`.

### 2.2 `POST /api/auth/refresh`
No body. Reads `crown_refresh`. 200 → `Session`, sets fresh `crown_access` + rotated `crown_refresh` (keeps the persistent/session choice from login; stored in `refresh_tokens.persistent`). 401 `refresh_invalid` | `refresh_reused` | `refresh_expired`, and clears all three cookies.

### 2.3 `POST /api/auth/logout`
No body. Revokes the presented refresh token. 204, clears all three cookies. Idempotent (204 even with no cookie).

### 2.4 `GET /api/auth/me`
200 → `Session`. 401 `unauthenticated` when the access cookie is missing/expired/invalid; the adapter then calls refresh once and retries.

### Admin guard
Every `/api/admin/*` route depends on `get_current_staff` (access cookie → staff row, `tv` check). Roles: `owner` and `staff` can use all admin routes; only `owner` can call `POST /api/admin/demo/reset`. 401 `unauthenticated`, 403 `forbidden`.

---

## 3. Public endpoints

### 3.1 `GET /api/public/state`
200:
```json
{
  "services": [ { "id": "classic", "name": "Classic cut", "detail": "Scissor or clipper, finished with a neck shave",
                  "minutes": 30, "price": 31, "category": "cuts", "visible": true } ],
  "barbers":  [ { "id": "any", "name": "First available", "note": "Shortest wait" },
                { "id": "tania", "name": "Tania", "note": "Named in more reviews than anyone", "role": "Barber",
                  "bio": "Tania cuts at Crown ..." } ],
  "hours":    [[], [], [[600, 840], [900, 1080]], [[600, 840], [900, 1080]], [[600, 840], [900, 1140]],
               [[600, 840], [900, 1140]], [[540, 840]]],
  "closures": ["2026-10-12"],
  "notice":   { "text": "Closed Monday for Thanksgiving.", "until": "2026-10-13" },
  "gallery":  [ { "id": "sample-0", "src": "https://images.unsplash.com/photo-...", "caption": "Skin fade, blended by hand",
                  "style": "fade", "featured": true, "createdAt": 1790000000000 } ],
  "bookings": [ { "date": "2026-09-25", "time": 630, "barberId": "tania", "status": "confirmed" } ]
}
```
Rules (what the public may see):
- `services`: only `visible = true`, ordered by `position`. Every site read goes through `visibleServices()` (callsites.md B), so hidden rows are never needed on the site.
- `barbers`: all rows including the `any` pseudo-barber, ordered by `position` (`any` first). These fields are public by design (About page).
- `hours`: 7 entries as stored.
- `closures`: only dates `>= today` (Toronto). The site filters `>= today` anyway (`Visit.tsx:38`).
- `notice`: raw stored value or `null`; expiry is applied client-side by `activeNotice()`.
- `gallery`: live photos (`deleted_at IS NULL`), newest `createdAt` first. `sample` is **not** emitted on the public endpoint (the site never reads it).
- `bookings`: **redacted slots only**. One `PublicSlot` per booking with `status <> 'cancelled'` and `date BETWEEN today AND today + 60 days`. `status` is always normalized to `"confirmed"`. No `id`, `name`, `phone`, `note`, `serviceId`, `source`, `createdAt`, `sample`.
- `messages`: **not sent**. The adapter fills `messages: []`.

The adapter expands every `PublicSlot` to a full `Booking` shape so `isSlotTaken` (store.ts:329) type-checks unchanged: `{ id: '', createdAt: 0, name: '', phone: '', note: '', serviceId: '', source: 'online', ...slot }`. The site never renders bookings.

Leak test (E2 must have it): a booking with name `Leak Probe`, phone `5195550199`, note `probe-note` must not appear anywhere in the response text; cancelled bookings and bookings outside the window must not appear; hidden services must not appear.

### 3.2 `POST /api/public/bookings`
Rate limit `5/minute;20/hour` per client IP.

Request (client `id`, `createdAt`, `status`, `source`, `sample` are not accepted; extra keys are ignored):
```json
{ "serviceId": "fade", "barberId": "tania", "date": "2026-09-25", "time": 660,
  "name": "Test Client", "phone": "5195550100", "note": "" }
```
Server-side validation, in this order (each mirrors a design rule):

| Check | Rule | Status / code | Mirrors |
|---|---|---|---|
| name | `strip()`, length 2..80 | 422 `invalid_name` | `Booking.tsx:147` |
| phone | `strip()`, <= 25 chars, at least 10 digits | 422 `invalid_phone` | `Booking.tsx:148` |
| note | `strip()`, <= 500 chars | 422 `invalid_note` | new (cap only) |
| service | exists and `visible` | 422 `unknown_service` | `Booking.tsx:77` |
| barber | exists (`any` allowed) | 422 `unknown_barber` | `Booking.tsx:319` |
| window | `today <= date <= today + 60 days` | 422 `outside_window` | `BOOK_AHEAD_DAYS = 60`, `Booking.tsx:27,109` |
| closure | date not in `closures` | 422 `day_off` | `isDayOff`, `hoursOn` |
| hours | `time` is on the grid `a + 30k` of a range `[a, b]` of `hoursOn(date)` with `time + service.minutes <= b` | 422 `outside_hours` | `slotsOn`, `Booking.tsx:31-46` |
| past | if `date == today`: `time > now.minutes + 20` | 422 `past_time` | `Booking.tsx:38` |
| capacity | `isSlotTaken` rule, under a transaction advisory lock | 409 `slot_taken` | `store.ts:329-334`; see schema.md "Capacity" |

On success the row is inserted with `id` = server `uid()` (same alphabet as `store.ts:86`), `status='requested'`, `source='online'`, `sample=false`, `created_at=now()`, and a `shop_new_request` SMS is queued (section 6).

201:
```json
{ "slot": { "date": "2026-09-25", "time": 660, "barberId": "tania", "status": "confirmed" } }
```
Error messages (the site shows its own copy; these are for logs and curl):
- 409 `slot_taken`: `"Someone just took that time. Pick another one and try again."` (the design's own copy, `Booking.tsx:158`).
- 422 `*`: short English sentence.
- 429 `rate_limited`.

### 3.3 `POST /api/public/messages`
Rate limit `5/minute;20/hour` per client IP.

Request:
```json
{ "name": "Carol Mitchell", "phone": "519-555-0158", "body": "Is there a step at the front door?" }
```
Validation: name 2..80 (`Visit.tsx:174`), phone >= 10 digits and <= 25 chars (`Visit.tsx:175`), body `strip()` 5..1000 (`Visit.tsx:176` plus a cap). 422 `invalid_name` | `invalid_phone` | `invalid_body`.

201: `{ "ok": true }`. Row stored with server id, `read=false`, `archived=false`, `sample=false`. No SMS (the plan's SMS list does not include messages).

### 3.4 `GET /api/media/{name}`
Only mounted when Cloudinary is not configured (`CROWN_CLOUDINARY_CLOUD_NAME` empty). Serves `MEDIA_DIR/{name}` (default `Backend/media/`), `name` must match `^[a-z0-9]{8,40}\.(jpg|png|webp)$`, else 404. `Cache-Control: public, max-age=31536000, immutable` (names are content hashes). Dev only; see validation.md V20.

---

## 4. Admin endpoints

All require the access cookie and (for non-GET) `X-Crown: 1`. Common errors: 401 `unauthenticated`, 403 `forbidden` / `csrf`, 422 validation.

### 4.1 `GET /api/admin/state`
200:
```json
{
  "state": {
    "services": [ Service, ... ],     // all, including visible:false, ordered by position
    "barbers":  [ Barber, ... ],      // all, 'any' first
    "hours":    Hours,
    "gallery":  [ Photo, ... ],       // live photos only, with sample:true where set
    "bookings": [ Booking, ... ],     // ALL bookings, every status, every date (CSV export needs them)
    "messages": [ Message, ... ],     // all, including archived
    "notice":   Notice,
    "closures": [ "YYYY-MM-DD", ... ] // all stored dates (past included; the UI filters)
  },
  "meta": { "mediaKb": 2210, "demoMode": true, "now": { "ymd": "2026-09-25", "minutes": 615, "epochMs": 1790000100000 } }
}
```
`state` is exactly `CrownState`. `meta` is outside it so the store type does not change. `meta.mediaKb` is the rounded sum of `media.bytes / 1024` for uploads still referenced by a live photo or a barber portrait; `storageUsedKb()` returns it (the stand-in Unsplash photos count as 0).

### 4.2 Config slices: whole-slice PUT
Each takes the **entire slice** as the JSON body and returns the stored slice (200). The server replaces the stored slice in one transaction.

`PUT /api/admin/services`, body `Service[]`:
- ids unique, `^[a-z0-9-]{1,40}$` (design ids like `cut-beard`, `uid()` output).
- `name` non-empty after trim, `detail` any (trimmed by the client), `price` 0..999 with at most 2 decimals, `minutes` 5..240, `category` in `cuts|shaves` (all from `PricesAdmin.tsx:97`). `visible` defaults to `true` when absent.
- Array order is stored as `position`.
- Rows missing from the body are deleted. Bookings keep their `serviceId` (no FK); the admin shows "Removed service" (`Bookings.tsx:14`).

`PUT /api/admin/barbers`, body `Barber[]`:
- Must contain exactly one `{id: 'any'}` row, else 422 `any_required`. The `any` row may only carry `id`, `name`, `note`.
- Every `name` non-empty after trim (`TeamAdmin.tsx:78`).
- `photo`, when present, must be `https://...` or `/api/media/...`; a `data:` URL is 422 `inline_image` (the adapter uploads first, section 5).
- `specialties`: array of <= 8 strings, each <= 40 chars.
- Omitted optional keys are stored as NULL; `''` and `[]` are stored as-is (TeamAdmin distinguishes `bio: ''` from missing, `TeamAdmin.tsx:76`).
- Rows missing from the body are deleted (bookings keep `barberId`).

`PUT /api/admin/hours`, body `Hours`:
- exactly 7 arrays; each range `[a, b]` with `0 <= a < b <= 1440`; ranges within a day sorted and non-overlapping (what `HoursAdmin.toHours` produces). 422 `invalid_hours`.
- Existing bookings are not touched.

`PUT /api/admin/closures`, body `string[]`:
- each a valid `YYYY-MM-DD`; duplicates removed; stored as a set; response sorted ascending.
- Existing bookings on a closed day are not touched (the toast tells the owner how many to call, `HoursAdmin.tsx:255-263`).

`PUT /api/admin/notice`, body `{ "text": "Closed today, ...", "until": "2026-10-13" | null }`:
- `text` trimmed, 5..280 chars (`HoursAdmin.tsx:180` requires >= 5), `until` null or a date. 200 returns the stored notice.

`DELETE /api/admin/notice`: sets the notice to `null`. 204.

### 4.3 `POST /api/admin/bookings`
Body: a full `Booking` as the admin builds it (`Bookings.tsx:240-244`, `Today.tsx:365-377`):
```json
{ "id": "k3j9x0aa8d2f", "createdAt": 1790000100000, "name": "Walk-in", "phone": "", "note": "",
  "serviceId": "fade", "barberId": "tania", "date": "2026-09-25", "time": 615,
  "status": "done", "source": "walk-in" }
```
Validation:
- `id` `^[a-z0-9-]{1,40}$` and unused, else 409 `duplicate_id`.
- `name` 1..80 after trim (walk-ins default to `'Walk-in'`).
- `phone`: may be `''` only when `source = 'walk-in'`; otherwise >= 10 digits (`Bookings.tsx:219`).
- `serviceId`: any existing service (hidden allowed; the admin form lists all, `Bookings.tsx:272`). `barberId`: any existing barber including `any`.
- `date` valid; `time` 0..1439. **No** hours/closure/past/window checks: the admin form checks hours itself (`Bookings.tsx:221`), and walk-ins are logged at the current minute rounded to 5 (`Today.tsx:374`), which can fall outside hours. Staff judgment wins.
- `status`, `source` from the enums. `createdAt` from the client is accepted (ms). `sample` is ignored and stored `false`.
- Capacity: only the partial unique index applies (schema.md). A clash → 409 `slot_taken` (`"Tania already has a booking at that time."`).
- No SMS on create (an admin-entered booking is arranged in person or by phone).

201 → the stored `Booking`.

### 4.4 `PATCH /api/admin/bookings/{id}`
Body: any subset of `name, phone, note, serviceId, barberId, date, time, status, source` (the adapter sends only changed keys). `id`, `createdAt`, `sample` are immutable (422 `immutable_field`). Same per-field validation as 4.3.
- 404 `not_found`. 409 `slot_taken` if the change would violate the partial unique index (for example undoing a cancel after someone else took the slot).
- Status side effects (section 6): `requested → confirmed` queues `confirmed` SMS; `requested → cancelled` queues `declined` SMS; any later status change cancels still-pending confirm/decline SMS for the booking. Undo is therefore safe inside the grace window.
- 200 → the stored `Booking`.

### 4.5 `PATCH /api/admin/messages/{id}`
Body: `{ "read": true }`, `{ "read": false }`, `{ "archived": true | false }` or both keys. Anything else 422. 404 `not_found`. 200 → `Message`.

### 4.6 `POST /api/admin/uploads`
`multipart/form-data`: `file` (required), `kind` = `gallery` | `portrait`.
- Accepts `image/jpeg`, `image/png`, `image/webp`; checked by magic bytes, not just the header. 415 `unsupported_type`.
- Max 5 MB (the client already shrinks to 1400 px / 900 px JPEG, `GalleryAdmin.tsx:7`, `TeamAdmin.tsx:9`). 413 `too_large`.
- Storage: Cloudinary signed upload via httpx when `CROWN_CLOUDINARY_*` are set (folder `crown/<kind>`), else `MEDIA_DIR/<sha256[:24]>.<ext>` served by 3.4.
- Records a `media` row (url, bytes, kind).
- 201: `{ "url": "https://res.cloudinary.com/.../crown/gallery/ab12.jpg", "bytes": 214332 }` (local: `"/api/media/ab12cd34ef56ab12cd34ef56.jpg"`).

### 4.7 `POST /api/admin/gallery`
Body: a `Photo` whose `src` is already a URL:
```json
{ "id": "p7a0k2m9x1c4", "src": "/api/media/ab12cd34ef56ab12cd34ef56.jpg", "caption": "", "style": "classic",
  "featured": false, "createdAt": 1790000100000 }
```
- `src` starting `data:` → 422 `inline_image`. Otherwise must be `https://` or `/api/media/`.
- `style` in the 5 `CutStyle` values; `caption` <= 140 chars.
- **Restore semantics (undo):** if a row with this `id` exists and is soft-deleted, it is restored (`deleted_at = NULL`), keeping its stored `sample` flag and applying `caption/style/featured/createdAt` from the body; 200. If it exists and is live, 409 `duplicate_id`. Otherwise it is created with `sample=false` (client `sample` ignored); 201.
- Response: the stored `Photo`.

### 4.8 `PATCH /api/admin/gallery/{id}`
Body: subset of `caption`, `style`, `featured`, `createdAt`. `createdAt` is writable because reordering swaps two photos' `createdAt` (`GalleryAdmin.tsx:103-111`). 404 for unknown or soft-deleted ids. 200 → `Photo`.

### 4.9 `DELETE /api/admin/gallery/{id}`
Soft delete (`deleted_at = now()`); the media file is kept so undo works. 204. 404 if unknown or already deleted.

### 4.10 `POST /api/admin/demo/reset`
- Owner only. When `DEMO_MODE != 1`: 404 `not_found` (the route does not exist in production).
- In one transaction: delete all bookings, messages, photos, closures, notice, pending SMS; restore services/barbers/hours to the design defaults (`data.ts` SERVICES/BARBERS/HOURS); insert the demo samples relative to `now_toronto()` exactly as `seed.py --demo` does (ids `sample-0..11`, `sample-b0..8`, `sample-m0..2`, `sample: true`). Staff and refresh tokens are untouched (the user stays signed in).
- 200 → same body as `GET /api/admin/state`.

---

## 5. Images: data URL → upload → URL

The design shrinks images in the browser and stores `data:image/jpeg;base64,...` straight into the slice (`GalleryAdmin.tsx:21`, `TeamAdmin.tsx:23`). The components keep doing that. The adapter, before sending any gallery `POST` or barbers `PUT`:
1. finds every `src` (gallery) / `photo` (barbers) that starts with `data:`;
2. converts it to a `Blob` (`fetch(dataUrl).then(r => r.blob())`) and posts it to `POST /api/admin/uploads` with `kind`;
3. replaces the value with the returned `url` in both the request body and the local state (so the next `JSON.stringify` dirty check in TeamAdmin compares URL to URL);
4. then sends the POST/PUT.

A TeamAdmin portrait picked and then discarded (Discard button) never leaves the browser, so no orphan uploads are created by drafts. The server never accepts `data:` values (defence in depth).

---

## 6. SMS (Twilio via httpx, `Utils/sms.py`)

### Transport
`POST https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json`, basic auth, form fields `To`, `From` (`TWILIO_FROM_NUMBER`), `Body`. Phone normalization to E.164: strip non-digits; 10 digits → `+1` prefix; 11 digits starting with `1` → `+` prefix; anything else is not sent (`status='failed'`, `error='bad_number'`).

Dry run: `SMS_DRY_RUN=1`, or any Twilio variable missing, or `DEMO_MODE=1` (forced, see decisions.md D9). Dry run logs one line at INFO: `SMS DRY RUN kind=<kind> to=+1519***0100 body="<body>"` and marks the outbox row `dry_run`. Rows with `sample=true` bookings are never sent (marked `cancelled`, `error='sample'`).

### Outbox
All sends go through `sms_outbox` (schema.md). A 5-second APScheduler interval job picks rows `status='pending' AND send_after <= now()` with `FOR UPDATE SKIP LOCKED`, sends, and records the result. Max 3 attempts with 1 min backoff.

### Trigger points

| Kind | Trigger | To | `send_after` | Cancelled when |
|---|---|---|---|---|
| `shop_new_request` | `POST /api/public/bookings` succeeds | `CROWN_SHOP_SMS_TO` (skipped if empty) | now | never |
| `confirmed` | admin PATCH `status: requested → confirmed`, source `online` | booking phone | now + 10 s | the booking's status changes again before sending (for example undo) |
| `declined` | admin PATCH `status: requested → cancelled`, source `online` | booking phone | now + 10 s | same |
| `reminder` | 09:00 America/Toronto daily cron: bookings with `date = today`, `status = 'confirmed'`, phone present, not sample | booking phone | now | booking no longer confirmed at send time (re-checked) |

The 10-second grace outlasts the 6-second undo toast (`kit.tsx:519`). Reminders are unique per `(booking_id, for_date)`. Bookings confirmed after 09:00 for the same day get no reminder (they just got the confirmation). A confirmed booking that the shop later cancels (`confirmed → cancelled`, "Cancel booking") sends nothing; see validation.md V17.

### Copy (derived from the design's wording)
Vocabulary used by the design: "reserve a chair", "holds your spot", "the first available barber", "Cash only", "call the shop", `(519) 763-2229`, dates like `Fri, Sep 25`, times like `10 AM` / `10:30 AM` (`fmtTime`, `fmtYmd` with `{weekday:'short', month:'short', day:'numeric'}`). `{barber}` is the barber name, or `the first available barber` for `any` (`Booking.tsx:469`). `{when}` = `Today`/`Tomorrow`/`Fri, Sep 25` + ` at ` + time, the same logic as `whenLabel` (`Booking.tsx:226`).

- `shop_new_request`: `Crown: new chair request. {name}, {service} with {barber}, {when}. Confirm it in the admin: {FRONTEND_ORIGIN}/admin/bookings`
- `confirmed`: `Crown Barber Shop: your chair is confirmed. {service} with {barber}, {when}. 219 Silvercreek Pkwy N. Cash only. To change it, call (519) 763-2229.`
- `declined`: `Crown Barber Shop: sorry, we can't hold {when} for you. Walk-ins are always welcome, or call (519) 763-2229 to find another time.`
- `reminder`: `Crown Barber Shop: see you today at {time} for your {service}. Cash only. Running late or can't make it? Call (519) 763-2229.`

`{name}` is the first 40 characters of the booking name. Shop facts come from `data.ts SHOP` (mirrored in `Backend/shop.py`).

---

## 7. Toronto time rules (server)

- `TZ = ZoneInfo("America/Toronto")`. `now_toronto()` returns an aware datetime (or the override, section 0).
- `today = now_toronto().date()`; `minutes = hour * 60 + minute`.
- Day of week: `(d.weekday() + 1) % 7` so 0 = Sunday, matching `dayOfYmd` (`store.ts:92`) and `HOURS` index.
- `hours_on(d)`: `[]` if `d` is a closure, else `hours[dow(d)]` (`store.ts:337`).
- Slot grid: for each `[a, b]`, `m = a, a + 30, ...` while `m + service.minutes <= b` (`Booking.tsx:37`). Today: skip `m <= minutes + 20` (`Booking.tsx:38`).
- Window: `today <= date <= today + timedelta(days=60)`. Calendar arithmetic, not +86 400 000 ms.
- Appointment time is stored as `date` + `time` (smallint minutes). No timestamptz for appointments, so DST never shifts a booking.
- `created_at` columns are `timestamptz` (UTC), serialized as epoch ms.
- Reminder cron: APScheduler `CronTrigger(hour=9, minute=0, timezone=TZ)`, `misfire_grace_time=3600`, `coalesce=True`.
- `notice.until` and closures compare as ISO date strings / `date` values in Toronto.

---

## 8. Store adapter (`Frontend/src/lib/store.ts`)

Exports stay identical to the design (`useCrown`, `setSlice`, `resetDemo`, `storageUsedKb`, all helpers and types). Additions: `createBooking`, `sendMessage`, `CrownProvider`, `onSyncError`, `hydrateAdmin`, `signIn`, `signOut`, `getSession`.

### 8.1 Hydration
- **Site:** the `(site)` layout (server component) fetches `API_ORIGIN/api/public/state` with `cache: 'no-store'` and renders `<CrownProvider mode="public" initial={state}>`. On the client, the provider primes the module-level state **before** its children render; `useCrown()`'s `getServerSnapshot` returns `initial`, so SSR HTML and hydration match. The module singleton is never written on the server. Refetch on `visibilitychange → visible` and after a 409.
- **Admin:** client only. After `GET /api/auth/me` succeeds, `hydrateAdmin()` calls `GET /api/admin/state`; the Portal renders only once state is loaded (TeamAdmin/PricesAdmin/HoursAdmin copy state into `useState` at mount). Poll every 30 s while the tab is visible and the sync queue is empty; also refetch on focus. A poll result is ignored if a write started after the poll was sent.

### 8.2 `setSlice(key, next)` (admin)
1. Compute `value` (function or value), keep `prev = state[key]`, set `state = {...state, [key]: value}`, `emit()`.
2. Enqueue `{key, prev, value}` on one FIFO queue shared by all slices, and return `{ ok: true }` immediately. Before hydration it returns `{ ok: false, reason: 'unavailable' }` and changes nothing.
3. The queue worker turns each item into requests:

| Slice | Kind | Requests |
|---|---|---|
| `services`, `barbers`, `hours`, `closures` | config | `PUT` whole `value` (consecutive items for the same key are coalesced to the last value). Barbers: upload `data:` photos first. |
| `notice` | config | `value === null` → `DELETE /api/admin/notice`, else `PUT` |
| `bookings` | entity | diff `prev` vs `value` by `id`: added → `POST`; changed → `PATCH` with the top-level keys whose `JSON.stringify` differs; removed → no endpoint (8.4) |
| `messages` | entity | changed → `PATCH` (`read`/`archived` only); added/removed → no endpoint (8.4) |
| `gallery` | entity | added → (upload if `data:`) `POST` (restores if the id was soft-deleted); changed → `PATCH` changed keys; removed → `DELETE` |

Within one item, requests run sequentially (deletes, then patches, then posts).

4. Successful responses do **not** overwrite local state (except the upload URL swap in section 5), which keeps the dirty checks stable.

### 8.3 Failure, rollback, and the result type
`SaveResult` is widened to `{ ok: true } | { ok: false; reason: 'full' | 'unavailable' | 'taken' | 'invalid' | 'rate' | 'auth' }`. Existing `reason === 'full'` checks still compile.

On a failed request: 401 → one `POST /api/auth/refresh` then one retry; still 401 → clear state, `signOut()` event, the admin shows Login. Any other failure → drop the rest of the queue, `GET /api/admin/state`, replace state (this is the rollback: server truth wins), and fire `onSyncError({reason, message})`. The admin shell mounts one `<SyncErrorToasts/>` inside `ToastProvider` (`CrownShopAdmin.tsx:96`) that shows `toast({ text: message, tone: 'error' })`. Messages by reason:
- `taken`: `That time is already booked. Nothing was changed.`
- `invalid`: `That change could not be saved. Nothing was changed.`
- `unavailable`/`rate`: `Could not reach the shop's server. Your last change was undone.`

### 8.4 Unsupported diffs
Removing a booking, or adding/removing a message from the admin, cannot happen in the design. If the adapter sees one it logs `console.error('crown: unsupported diff', key, ids)` and resyncs. No endpoint exists for them.

### 8.5 Undo
Undo is not special. Every undo in the design (`Bookings.tsx:37`, `GalleryAdmin.tsx:96`, `:238`, `HoursAdmin.tsx:201`, `:266`, `Messages.tsx:42`) is another `setSlice`, so it becomes another PATCH/PUT/POST on the same queue, after the original request. Server-side consequences: gallery restore (4.7), SMS cancellation (section 6).

### 8.6 Site writes
`setSlice` in `mode="public"` only exists to satisfy imports; it logs `console.error` and returns `{ok:false, reason:'unavailable'}`. The two site writes use:
```ts
createBooking(input: { serviceId; barberId; date; time; name; phone; note }): Promise<SaveResult>
sendMessage(input: { name; phone; body }): Promise<SaveResult>
```
On success `createBooking` appends the returned `PublicSlot` (expanded) to `bookings` and emits, so the slot shows taken for this visitor. On 409 it returns `reason: 'taken'` and refetches public state. `Booking.tsx` and `Visit.tsx` need a small edit to await these (validation.md V1).

### 8.7 `resetDemo()` and `storageUsedKb()`
- `resetDemo()`: `POST /api/admin/demo/reset`, then replaces the whole state with the response and emits. Synchronous signature kept (fire and forget); failure goes through `onSyncError`.
- `storageUsedKb()`: returns `meta.mediaKb` from the latest admin state. Synchronous, no request.

### 8.8 CSV export
Stays client-side (`SettingsAdmin.tsx:17-33`), built from admin state. This works because `GET /api/admin/state` returns every booking. No export endpoint.

### 8.9 DEMO_MODE on the frontend
`NEXT_PUBLIC_DEMO_MODE=1` shows: the demo account box on Login (`Login.tsx:133-140`) and the demo forgot-password text (`Login.tsx:120`); the "Reset demo data" block in Settings (`SettingsAdmin.tsx:55-60`). With `0` those blocks are not rendered. "Remove N samples" (`GalleryAdmin.tsx:150`) needs no flag: it only renders when sample photos exist, and only `--demo` seeding / demo reset create them.

---

## 9. Environment variable names (values intentionally blank)

Backend:
```
ENV=
DATABASE_URL=
JWT_SECRET=
JWT_ALGORITHM=
ACCESS_TOKEN_EXPIRE_MINUTES=
REFRESH_TOKEN_EXPIRE_DAYS=
FRONTEND_ORIGIN=
COOKIE_SECURE=
TRUST_PROXY=
DEMO_MODE=
CROWN_CLOCK_OVERRIDE=
CROWN_OWNER_EMAIL=
CROWN_OWNER_PASSWORD=
CROWN_OWNER_NAME=
SMS_DRY_RUN=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
CROWN_SHOP_SMS_TO=
CROWN_CLOUDINARY_CLOUD_NAME=
CROWN_CLOUDINARY_API_KEY=
CROWN_CLOUDINARY_API_SECRET=
MEDIA_DIR=
```
Frontend:
```
API_ORIGIN=
NEXT_PUBLIC_DEMO_MODE=
```
E5 owns `docs/env.md` with descriptions and defaults.
