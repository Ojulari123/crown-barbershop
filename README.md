# Crown Barber Shop

Website and admin portal for Crown Barber Shop (219 Silvercreek Pkwy N, Guelph). The public site shows
services, prices, the team, the gallery and hours, and takes chair requests and questions. The admin
portal is where the shop confirms requests, logs walk-ins, answers messages and edits prices, hours,
team and photos. Confirmations, declines and a 9 AM reminder go to customers by SMS (Twilio).

The UI is a 1-to-1 port of the MagicPath design (`design-snapshot/`); `fidelity/` checks it pixel by
pixel. This build is a **client demo**: placeholder photos and copy are kept, and `DEMO_MODE` adds a
demo login and "Reset demo data".

## Architecture

```
browser ── https ──> Next.js 16 (Vercel) ── /api/* rewrite ──> FastAPI (Render, 1 instance) ──> Postgres (Neon)
                     site: server-rendered, reads /api/public/state         APScheduler: SMS outbox + 9 AM reminders
                     admin: client portal, httpOnly cookie auth             Twilio REST (dry run by default)
```

- **Frontend** (`Frontend/`): Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, framer-motion,
  lucide-react. The design's components live in `src/components/{site,admin}`; `src/lib/store.ts` keeps the
  design's `useCrown()`/`setSlice()` API and syncs it with the backend. The browser only talks to
  same-origin `/api/*`, which Next forwards to `API_ORIGIN`, so the auth cookies stay first-party.
- **Backend** (`Backend/`): Python 3.11, FastAPI, SQLAlchemy 2.0, psycopg2, plain-SQL migrations
  (`migrate.py`), pytest. Shop logic runs in `America/Toronto` time.
- **Docs**: `docs/api-contract.md` (endpoints), `docs/schema.md` (tables), `docs/decisions.md` (why),
  `docs/env.md` (every environment variable), `docs/local-dev.md` (this machine's running servers).

```
Backend/     main.py config.py db.py tables.py shop.py seed.py migrate.py migrations/ Routes/ Schemas/ Utils/ Tests/
Frontend/    src/app (routes) src/components (design port) src/lib (store, api, data) e2e/ playwright.config.ts
fidelity/    capture.ts compare.ts fonts-check.ts baseline/
design-snapshot/  frozen MagicPath sources (site, admin) + REVISIONS.md
render.yaml  .github/workflows/ci.yml
```

## Run locally from scratch

Prerequisites: Python 3.11, Node 22 (20.9 or newer), PostgreSQL 14 or newer.

### 1. Database

Any local Postgres works. Create a dev and a test database:

```bash
createdb crown
createdb crown_test        # pytest drops and recreates its schema; never point it at real data
```

No Postgres server yet? A throwaway cluster (macOS Homebrew example, any port):

```bash
initdb -D ./pgdata -U postgres --auth=trust
pg_ctl -D ./pgdata -o "-p 5544 -c listen_addresses=127.0.0.1" -l ./pgdata/server.log start
createdb -h 127.0.0.1 -p 5544 -U postgres crown
createdb -h 127.0.0.1 -p 5544 -U postgres crown_test
```

### 2. Backend (API on :8000)

```bash
cd Backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env
```

Fill in `Backend/.env` (details in `docs/env.md`). For a local demo:

```
DATABASE_URL=postgresql://postgres@127.0.0.1:5544/crown
JWT_SECRET=<output of: python3 -c "import secrets; print(secrets.token_hex(32))">
DEMO_MODE=1
```

```bash
.venv/bin/python migrate.py up          # applies migrations/*.sql, records them in schema_migrations
.venv/bin/python seed.py --demo         # shop defaults + demo owner + the design's sample data (idempotent)
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
curl http://127.0.0.1:8000/api/health   # {"ok":true}
```

`seed.py` without `--demo` needs `CROWN_OWNER_EMAIL` and `CROWN_OWNER_PASSWORD` for the first run. The demo
owner is `owner@crownbarbershop.ca` / `crown2026` (the design's public demo login). With `DEMO_MODE=1`, SMS is
always a dry run: texts appear in the API log as `SMS DRY RUN kind=... to=... body="..."`.

### 3. Frontend (site on :3000)

```bash
cd Frontend
npm ci
cp .env.example .env.local              # optional: API_ORIGIN defaults to http://127.0.0.1:8000
NEXT_PUBLIC_DEMO_MODE=1 npm run build
NEXT_PUBLIC_DEMO_MODE=1 npm run start   # http://127.0.0.1:3000 and http://127.0.0.1:3000/admin
```

`npm run dev` works too (hot reload, same port). Use `127.0.0.1`, not `localhost`: uvicorn listens on IPv4
only, and Safari tries `::1` first. Other ports: `npx next start -H 127.0.0.1 -p 3100` with
`API_ORIGIN=http://127.0.0.1:8100` set for both build and start.

## Tests

```bash
# Backend: 75 tests against TEST_DATABASE_URL (default postgresql://postgres@127.0.0.1:5544/crown_test)
cd Backend && TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5544/crown_test .venv/bin/python -m pytest -q

# Frontend: types, lint, build
cd Frontend && npx tsc --noEmit && npm run lint && npm run build

# End to end, against the running stack (API with DEMO_MODE=1 and the demo seed, web on :3000)
cd Frontend && npx playwright install chromium
E2E_BASE_URL=http://127.0.0.1:3000 E2E_API_LOG=/path/to/api.log npm run e2e
```

The e2e specs (`Frontend/e2e/`) cover: a booking on the site shows up in the admin, confirming it turns it
`confirmed` and logs the dry-run confirmation text (read from `E2E_API_LOG`; skipped with a note if unset);
a question from the Visit page lands in the inbox; a signed-out `/admin/today` redirects to `/admin/login`.
They sign in once (`e2e/auth.setup.ts`) and reuse the session, because the API allows 10 logins a minute.
Without `E2E_BASE_URL`, Playwright starts `npm run start` itself (build first; port 3000 must be free).

Fidelity (pixel diff against the design): see `fidelity/README.md`.

CI (`.github/workflows/ci.yml`): pytest on a Postgres 16 service (migrations first), then `tsc --noEmit`,
lint and `next build`.

## Deploy

Order: Neon database, then Render (API), then Vercel (web), then set `FRONTEND_ORIGIN` on Render to the
Vercel URL.

### Neon (Postgres)

1. Create a project (region near Render's, e.g. US East) and a database, e.g. `crown`.
2. Copy the connection string from the dashboard. Use the **direct** one (host without `-pooler`) and keep
   `?sslmode=require`: `postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/crown?sslmode=require`.
   `migrate.py` takes a session-level advisory lock, which Neon's pooled endpoint (PgBouncer, transaction
   mode) does not support. One API instance with SQLAlchemy's default pool (5 + 10 overflow) is well
   within Neon's direct connection limit.
3. Put it in Render as `DATABASE_URL`. Neon suspends idle databases; the first request after a pause takes
   a moment longer (`pool_pre_ping` in `db.py` covers dropped connections).

### Render (API)

1. New > Blueprint, pick this repo; Render reads `render.yaml` (web service `crown-api`, `rootDir: Backend`,
   Python 3.11.8, one instance, health check `/api/health`).
2. Fill the `sync: false` values: `DATABASE_URL`, `FRONTEND_ORIGIN` (the Vercel URL, `https://...`, no trailing
   slash), `CROWN_OWNER_EMAIL`, `CROWN_OWNER_PASSWORD`, `CROWN_OWNER_NAME`, the Cloudinary trio, and Twilio if
   going live. `JWT_SECRET` is generated. `ENV=production`, `COOKIE_SECURE=1`, `TRUST_PROXY=1` and
   `DEMO_MODE=1` are preset.
3. Every start runs `python migrate.py up && python seed.py && uvicorn ...` (same as `Backend/Procfile`).
   Both scripts are safe to repeat: applied migrations are skipped, and the seed only inserts missing rows
   (services, barbers, `shop_settings`, the owner) and never overwrites edits or an existing password. For
   the demo, sign in and use Settings > "Reset demo data" to load the sample bookings.
4. **Keep it at one instance.** The SMS outbox and the 9 AM reminder run in the web process; two
   instances would text twice.
5. **Set Cloudinary.** Render's disk is wiped on each deploy, so without it uploaded photos disappear.

`TRUST_PROXY=1`: the rate limits (5 bookings/minute, 10 logins/minute, ...) key on the first
`X-Forwarded-For` hop. Behind Vercel and Render every request's socket address is a proxy, so without it all
visitors would share one bucket. Only enable it behind a proxy that sets that header; otherwise a client
could pick its own key.

### Vercel (web)

1. Import the repo, set **Root Directory** to `Frontend` (framework: Next.js, detected). No `vercel.json`
   is needed.
2. Environment variables (Production, and Preview if used), available at **build and runtime**:
   - `API_ORIGIN=https://crown-api.onrender.com` (your Render URL). Rewrites are compiled at build time.
   - `NEXT_PUBLIC_DEMO_MODE=1` for the client demo (inlined at build; redeploy after changing it).
3. Deploy, then set Render's `FRONTEND_ORIGIN` to the Vercel URL.

Not verified yet (needs a real deployment): that Vercel's external rewrite passes the visitor's
`X-Forwarded-For` through to Render (the rate limits depend on it), and that it passes the API's `Set-Cookie`
headers back unchanged (sign-in depends on it). Check both after the first deploy: sign in to `/admin`, and
watch the Render log for the client IP.

### Twilio (SMS)

- Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (E.164, e.g. `+1519...`),
  optional `CROWN_SHOP_SMS_TO` (the shop's phone, for "new request" texts).
- Dry run: when any `TWILIO_*` is missing, or `SMS_DRY_RUN=1`, or `DEMO_MODE=1`, texts are written to the log
  instead of sent. `DEMO_MODE=1` always wins, because the demo login is public.
- What gets sent: a new online request (to the shop), confirm, decline and cancel of an online booking (to the
  customer, after a 10 s undo grace), and a 9 AM Toronto reminder for the day's confirmed bookings.
- Going live: set the three `TWILIO_*` values, set `DEMO_MODE=0` on Render, change the owner password from
  anything public, rebuild Vercel with `NEXT_PUBLIC_DEMO_MODE` unset, and confirm the log says
  `sms dry run=False` at startup. Do a CASL/consent review first (docs/decisions.md, open question 4).

## Local servers on this machine

See `docs/local-dev.md` for what is running now (ports, PIDs, logs, start and stop commands).
