# Crown Barber Shop: database schema (v1)

Postgres 14+ (local verification cluster) / Neon (production). Plain SQL migrations in `Backend/migrations/`, named like Housing's (`YYYY-MM-DD_<name>.sql`), applied by `migrate.py` into `schema_migrations`. No Alembic, no `create_all`, no `ALTER` at startup.

Proposed first migration: `2026-09-24_init.sql` containing everything below. SQLAlchemy 2.0 models in `tables.py` mirror it (`DeclarativeBase`, `Mapped[...]`, `mapped_column`); the models never create tables.

Conventions: snake_case columns; the API maps to camelCase (api-contract.md section 0). Ids of design entities are `text` because the design generates them in the browser (`uid()`, `store.ts:86`) and uses readable seed ids (`classic`, `tania`, `sample-b3`). Id check used below: `CHECK (id ~ '^[a-z0-9-]{1,40}$')`.

---

## 1. Tables

### `staff`
| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `email` | `text NOT NULL` | stored lowercased; `UNIQUE` |
| `name` | `text NOT NULL` | shown in the admin avatar (`SettingsAdmin.tsx:39-42`) |
| `role` | `text NOT NULL DEFAULT 'owner'` | `CHECK (role IN ('owner','staff'))` |
| `password_hash` | `text NOT NULL` | bcrypt |
| `token_version` | `integer NOT NULL DEFAULT 0` | bumped on password change; JWT claim `tv` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

Indexes: `ux_staff_email UNIQUE (email)`.

### `refresh_tokens`
Mirrors Housing `RefreshToken` as used in `Utils/security.py:399-537`.
| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `token_hash` | `char(64) NOT NULL` | SHA-256 hex of the raw token |
| `staff_id` | `bigint NOT NULL REFERENCES staff(id) ON DELETE CASCADE` | |
| `family_id` | `uuid NOT NULL` | one per login; reuse revokes the family |
| `is_revoked` | `boolean NOT NULL DEFAULT false` | |
| `replaced_by` | `char(64)` NULL | successor hash (lost-response grace) |
| `persistent` | `boolean NOT NULL` | "Keep me signed in" (`Login.tsx:31`) → cookie Max-Age or session cookie |
| `expires_at` | `timestamptz NOT NULL` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Indexes: `ux_refresh_tokens_hash UNIQUE (token_hash)`, `ix_refresh_tokens_family (family_id)`, `ix_refresh_tokens_staff (staff_id)`.

### `services`
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | id check |
| `name` | `text NOT NULL` | `CHECK (length(btrim(name)) > 0)` |
| `detail` | `text NOT NULL DEFAULT ''` | |
| `minutes` | `integer NOT NULL` | `CHECK (minutes BETWEEN 5 AND 240)` |
| `price` | `numeric(5,2) NOT NULL` | `CHECK (price BETWEEN 0 AND 999)` |
| `category` | `text NOT NULL` | `CHECK (category IN ('cuts','shaves'))` |
| `visible` | `boolean NOT NULL DEFAULT true` | |
| `position` | `integer NOT NULL` | array order of the last PUT |

Index: `ix_services_position (position)`.

### `barbers`
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | id check; the row `id = 'any'` ("First available") always exists |
| `name` | `text NOT NULL` | `CHECK (length(btrim(name)) > 0)` |
| `note` | `text NOT NULL DEFAULT ''` | |
| `role` | `text` NULL | NULL → key omitted on the wire |
| `bio` | `text` NULL | NULL ≠ `''` (TeamAdmin falls back to the design bio only when missing, `TeamAdmin.tsx:76`) |
| `specialties` | `text[]` NULL | NULL ≠ `{}` |
| `photo` | `text` NULL | URL; `CHECK (photo IS NULL OR photo !~ '^data:')` |
| `position` | `integer NOT NULL` | |

Constraint: `CHECK (id <> 'any' OR (role IS NULL AND bio IS NULL AND specialties IS NULL AND photo IS NULL))`. The API refuses a PUT that drops `any`.

### `shop_settings` (single row)
| Column | Type | Notes |
|---|---|---|
| `id` | `smallint` PK | `CHECK (id = 1)` |
| `hours` | `jsonb NOT NULL` | `Hours`: 7 arrays of `[open, close]` minute pairs; shape validated by the API (api-contract.md 4.2) plus `CHECK (jsonb_typeof(hours) = 'array' AND jsonb_array_length(hours) = 7)` |
| `notice_text` | `text` NULL | NULL = no notice |
| `notice_until` | `date` NULL | `CHECK (notice_text IS NOT NULL OR notice_until IS NULL)` |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

### `closures`
| Column | Type | Notes |
|---|---|---|
| `day` | `date` PK | a day off (`CrownState.closures`) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

### `bookings`
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | id check. Admin: client id. Public: server `uid()` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | wire `createdAt` (ms) |
| `name` | `text NOT NULL` | `CHECK (length(name) BETWEEN 1 AND 80)` |
| `phone` | `text NOT NULL DEFAULT ''` | `''` only for walk-ins (API rule) |
| `note` | `text NOT NULL DEFAULT ''` | `CHECK (length(note) <= 500)` |
| `service_id` | `text NOT NULL` | **no FK**: services can be deleted, bookings stay ("Removed service", `Bookings.tsx:14`) |
| `barber_id` | `text NOT NULL` | **no FK**: barbers can be removed and "Existing bookings stay" (`TeamAdmin.tsx:260`). `'any'` = first available |
| `date` | `date NOT NULL` | Toronto calendar date |
| `time` | `smallint NOT NULL` | minutes after midnight, `CHECK (time BETWEEN 0 AND 1439)` |
| `status` | `text NOT NULL` | `CHECK (status IN ('requested','confirmed','done','cancelled','no-show'))` |
| `source` | `text NOT NULL` | `CHECK (source IN ('online','phone','walk-in'))` |
| `sample` | `boolean NOT NULL DEFAULT false` | demo seed rows |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

Indexes:
- `ux_bookings_live_barber_slot UNIQUE (barber_id, date, time) WHERE status IN ('requested','confirmed') AND barber_id <> 'any'`: the backstop against double-booking a named barber (see section 2 for why the predicate is narrower than "not cancelled").
- `ix_bookings_slot (date, time) WHERE status <> 'cancelled'`: capacity counts and the public slot list.
- `ix_bookings_status (status)`: requests tab, reminder job.

### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | server `uid()` (public), seed ids for samples |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `name` | `text NOT NULL` | `CHECK (length(name) BETWEEN 2 AND 80)` |
| `phone` | `text NOT NULL` | |
| `body` | `text NOT NULL` | `CHECK (length(body) BETWEEN 5 AND 1000)` |
| `read` | `boolean NOT NULL DEFAULT false` | |
| `archived` | `boolean NOT NULL DEFAULT false` | |
| `sample` | `boolean NOT NULL DEFAULT false` | |

Index: `ix_messages_created (created_at DESC)`.

### `photos` (the `gallery` slice)
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | id check (client id or `sample-N`) |
| `src` | `text NOT NULL` | URL, `CHECK (src !~ '^data:')` |
| `caption` | `text NOT NULL DEFAULT ''` | `CHECK (length(caption) <= 140)` |
| `style` | `text NOT NULL` | `CHECK (style IN ('fade','classic','beard','kids','shave'))` |
| `featured` | `boolean NOT NULL DEFAULT false` | |
| `created_at` | `timestamptz NOT NULL` | wire `createdAt`; **client-writable**: it is the sort key and reorder swaps it (`GalleryAdmin.tsx:103-111`) |
| `sample` | `boolean NOT NULL DEFAULT false` | server-controlled; preserved on restore |
| `deleted_at` | `timestamptz` NULL | soft delete so undo can restore (api-contract.md 4.7, 4.9) |

Index: `ix_photos_live (created_at DESC) WHERE deleted_at IS NULL`.

### `media`
One row per uploaded file (for `storageUsedKb()` and later cleanup).
| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `url` | `text NOT NULL UNIQUE` | what `photos.src` / `barbers.photo` store |
| `storage` | `text NOT NULL` | `CHECK (storage IN ('cloudinary','local'))` |
| `storage_key` | `text NOT NULL` | Cloudinary `public_id` or local filename |
| `kind` | `text NOT NULL` | `CHECK (kind IN ('gallery','portrait'))` |
| `bytes` | `integer NOT NULL` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

`meta.mediaKb` = `round(sum(bytes)/1024)` over media whose `url` is referenced by a live photo or a barber. Purging unreferenced media is out of scope for the demo (validation.md V20).

### `sms_outbox`
| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `booking_id` | `text` NULL | no FK (booking rows are never deleted except by demo reset, which clears the outbox too) |
| `kind` | `text NOT NULL` | `CHECK (kind IN ('shop_new_request','confirmed','declined','reminder'))` |
| `for_date` | `date` NULL | set for `reminder` |
| `to_phone` | `text NOT NULL` | E.164 |
| `body` | `text NOT NULL` | |
| `status` | `text NOT NULL DEFAULT 'pending'` | `CHECK (status IN ('pending','sent','dry_run','failed','cancelled'))` |
| `send_after` | `timestamptz NOT NULL DEFAULT now()` | confirm/decline: now + 10 s (undo grace) |
| `attempts` | `smallint NOT NULL DEFAULT 0` | max 3 |
| `provider_sid` | `text` NULL | Twilio SID |
| `error` | `text` NULL | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `sent_at` | `timestamptz` NULL | |

Indexes: `ix_sms_pending (send_after) WHERE status = 'pending'`; `ux_sms_reminder_once UNIQUE (booking_id, for_date) WHERE kind = 'reminder'` (guards against a duplicate cron run or a second worker process).

### `schema_migrations`
Owned by `migrate.py` (Housing format). Not described here.

---

## 2. Capacity and double-booking

### The rule (parity with the design)
`isSlotTaken(s, date, time, barberId)` (`store.ts:329-334`):
- `live` = bookings at exactly `(date, time)` with `status <> 'cancelled'` (so `requested`, `confirmed`, `done`, `no-show` all count);
- `realBarbers` = barbers except `any` (at least 1);
- `barberId = 'any'`: taken when `count(live) >= realBarbers`;
- a named barber: taken when that barber has a live booking at the slot, **or** `count(live) >= realBarbers`.

With today's data (one real barber, Tania) that means one booking per start time, whoever it is for.

Only exact start times collide. A 50-minute "Cut and beard" at 10:00 does not block 10:30. The server keeps this parity on purpose, so the site never offers a time the server refuses (validation.md V13).

### Enforcement for `POST /api/public/bookings`
Inside one transaction:
1. `SELECT pg_advisory_xact_lock(hashtext('crown:day:' || :date))`: serializes all public bookings for that day. There is no slot row to `SELECT ... FOR UPDATE` (the design has no slot table), and the `any` capacity rule cannot be expressed as a unique index, so a lock is required. Contention is one barbershop's traffic.
2. Re-read barbers and settings, run the validation list (api-contract.md 3.2).
3. `SELECT count(*), bool_or(barber_id = :barber) FROM bookings WHERE date = :date AND time = :time AND status <> 'cancelled'` and apply the rule above. Taken → 409 `slot_taken`.
4. `INSERT`. If the partial unique index still fires (`IntegrityError`, for example against a concurrent admin insert that does not take the lock), map it to 409 `slot_taken`.
5. Insert the `shop_new_request` outbox row. Commit.

### Admin writes
Admin `POST`/`PATCH` do not run the capacity rule (the admin form does not check it either, `Bookings.tsx:217-250`; staff may knowingly squeeze someone in). The partial unique index still stops two `requested`/`confirmed` bookings for the same named barber at the same start; that surfaces as 409 `slot_taken` and the adapter rolls back with a toast.

### Why the unique index predicate is `status IN ('requested','confirmed') AND barber_id <> 'any'`
- `barber_id <> 'any'`: several first-available bookings at one time are legal up to `realBarbers`; the index cannot count.
- `requested`/`confirmed` only: walk-ins are inserted as `done` at the current minute rounded to 5 (`Today.tsx:365-377`). Two walk-ins for Tania inside the same 5 minutes (a parent and child) would violate a "not cancelled" index and the second "Log walk-in" would fail. `done`/`no-show` rows are history and never need uniqueness.
- The public capacity check (step 3) still counts `done`/`no-show`, exactly like `isSlotTaken`.

### First available (`barberId = 'any'`)
Stored as `'any'` and **not** resolved to a named barber at booking time (decision D5 in decisions.md): the admin shows it as "First available" (`Bookings.tsx:17`), the sample data relies on it (`store.ts:143-149`), and the shop assigns on the day by editing the booking (`PATCH barberId`). The capacity rule above already guarantees a free barber exists at booking time.

---

## 3. Seed data (`seed.py`)

Always (idempotent upsert):
- `services` from `data.ts SERVICES` with `visible = true`, `position` = array index.
- `barbers` from `data.ts BARBERS` (`any`, `tania` with the design bio), `position` = index.
- `shop_settings(id=1, hours = data.ts HOURS, notice NULL)`.
- one `owner` staff row from `CROWN_OWNER_EMAIL` / `CROWN_OWNER_PASSWORD` / `CROWN_OWNER_NAME`; with `--demo` and those unset, the demo account `owner@crownbarbershop.ca` / name `Crown owner` with the design's demo password (`Login.tsx:9-13`), which is public by design and therefore only acceptable in DEMO_MODE.

`--demo` additionally (all rows `sample = true`, ids exactly as the design):
- 12 photos `sample-0..11` (`store.ts:113-138`), `created_at = now - i * 3 days`.
- 9 bookings `sample-b0..8` (`store.ts:140-166`), `date = today + d`, `created_at = now - (i + 1) hours`, note on `sample-b2` only.
- 3 messages `sample-m0..2` (`store.ts:168-202`), `created_at = now - 40 min / 5 h / 2 days`.

`--today YYYY-MM-DD` and `--now <ISO instant>` (new, see validation.md V9): dates come from `--today`, `created_at` offsets from `--now`. Defaults: `now_toronto()` and its date. Fidelity runs use `--now 2026-09-25T10:15:00-04:00`.
