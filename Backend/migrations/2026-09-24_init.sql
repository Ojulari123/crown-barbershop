-- Crown Barber Shop, initial schema (docs/schema.md v1).
-- Applied by migrate.py inside one transaction; no BEGIN/COMMIT here.

CREATE TABLE staff (
    id            bigserial PRIMARY KEY,
    email         text NOT NULL,
    name          text NOT NULL,
    role          text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
    password_hash text NOT NULL,
    token_version integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_staff_email ON staff (email);

CREATE TABLE refresh_tokens (
    id          bigserial PRIMARY KEY,
    token_hash  char(64) NOT NULL,
    staff_id    bigint NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    family_id   uuid NOT NULL,
    is_revoked  boolean NOT NULL DEFAULT false,
    replaced_by char(64),
    persistent  boolean NOT NULL,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX ix_refresh_tokens_staff ON refresh_tokens (staff_id);

CREATE TABLE services (
    id       text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,40}$'),
    name     text NOT NULL CHECK (length(btrim(name)) > 0),
    detail   text NOT NULL DEFAULT '',
    minutes  integer NOT NULL CHECK (minutes BETWEEN 5 AND 240),
    price    numeric(5, 2) NOT NULL CHECK (price BETWEEN 0 AND 999),
    category text NOT NULL CHECK (category IN ('cuts', 'shaves')),
    visible  boolean NOT NULL DEFAULT true,
    position integer NOT NULL
);
CREATE INDEX ix_services_position ON services (position);

CREATE TABLE barbers (
    id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,40}$'),
    name        text NOT NULL CHECK (length(btrim(name)) > 0),
    note        text NOT NULL DEFAULT '',
    role        text,
    bio         text,
    specialties text[],
    photo       text CHECK (photo IS NULL OR photo !~ '^data:'),
    position    integer NOT NULL,
    -- 'First available' is a pseudo-barber: it never carries profile fields.
    CHECK (id <> 'any' OR (role IS NULL AND bio IS NULL AND specialties IS NULL AND photo IS NULL))
);

CREATE TABLE shop_settings (
    id           smallint PRIMARY KEY CHECK (id = 1),
    hours        jsonb NOT NULL CHECK (jsonb_typeof(hours) = 'array' AND jsonb_array_length(hours) = 7),
    notice_text  text,
    notice_until date,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CHECK (notice_text IS NOT NULL OR notice_until IS NULL)
);

CREATE TABLE closures (
    day        date PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
    id         text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,40}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    phone      text NOT NULL DEFAULT '',
    note       text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
    -- No FKs to services/barbers: removing either keeps existing bookings (decisions D13).
    service_id text NOT NULL,
    barber_id  text NOT NULL,
    date       date NOT NULL,
    time       smallint NOT NULL CHECK (time BETWEEN 0 AND 1439),
    status     text NOT NULL CHECK (status IN ('requested', 'confirmed', 'done', 'cancelled', 'no-show')),
    source     text NOT NULL CHECK (source IN ('online', 'phone', 'walk-in')),
    sample     boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- Backstop for named barbers only; 'any' capacity is a count (schema.md section 2).
CREATE UNIQUE INDEX ux_bookings_live_barber_slot ON bookings (barber_id, date, time)
    WHERE status IN ('requested', 'confirmed') AND barber_id <> 'any';
CREATE INDEX ix_bookings_slot ON bookings (date, time) WHERE status <> 'cancelled';
CREATE INDEX ix_bookings_status ON bookings (status);

CREATE TABLE messages (
    id         text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,40}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    name       text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
    phone      text NOT NULL,
    body       text NOT NULL CHECK (length(body) BETWEEN 5 AND 1000),
    read       boolean NOT NULL DEFAULT false,
    archived   boolean NOT NULL DEFAULT false,
    sample     boolean NOT NULL DEFAULT false
);
CREATE INDEX ix_messages_created ON messages (created_at DESC);

CREATE TABLE photos (
    id         text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,40}$'),
    src        text NOT NULL CHECK (src !~ '^data:'),
    caption    text NOT NULL DEFAULT '' CHECK (length(caption) <= 140),
    style      text NOT NULL CHECK (style IN ('fade', 'classic', 'beard', 'kids', 'shave')),
    featured   boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL,
    sample     boolean NOT NULL DEFAULT false,
    deleted_at timestamptz
);
CREATE INDEX ix_photos_live ON photos (created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE media (
    id          bigserial PRIMARY KEY,
    url         text NOT NULL UNIQUE,
    storage     text NOT NULL CHECK (storage IN ('cloudinary', 'local')),
    storage_key text NOT NULL,
    kind        text NOT NULL CHECK (kind IN ('gallery', 'portrait')),
    bytes       integer NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sms_outbox (
    id           bigserial PRIMARY KEY,
    booking_id   text,
    -- 'cancelled' = shop cancelled a confirmed booking (Backend deviation B1 in decisions.md).
    kind         text NOT NULL CHECK (kind IN ('shop_new_request', 'confirmed', 'declined', 'cancelled', 'reminder')),
    for_date     date,
    to_phone     text NOT NULL,
    body         text NOT NULL,
    status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dry_run', 'failed', 'cancelled')),
    send_after   timestamptz NOT NULL DEFAULT now(),
    attempts     smallint NOT NULL DEFAULT 0,
    provider_sid text,
    error        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    sent_at      timestamptz
);
CREATE INDEX ix_sms_pending ON sms_outbox (send_after) WHERE status = 'pending';
CREATE UNIQUE INDEX ux_sms_reminder_once ON sms_outbox (booking_id, for_date) WHERE kind = 'reminder';
