# Environment variables

Every variable both apps read. Templates with names only: `Backend/.env.example`, `Frontend/.env.example`.
Never commit values. Booleans accept `1`/`0` (also `true`/`false`). Empty counts as unset (the backend
uses `env_ignore_empty`), so a copied `.env.example` falls back to the defaults below.

## Backend (`Backend/.env` locally, Render dashboard in production)

| Variable | Required | Default | Example (placeholder) | What it does |
|---|---|---|---|---|
| `ENV` | no | `development` | `production` | `production` disables `CROWN_CLOCK_OVERRIDE`. |
| `DATABASE_URL` | **yes** | none | `postgresql://USER:PASSWORD@HOST/DB?sslmode=require` | Postgres URL for the app, `migrate.py` and `seed.py`. On Neon use the **direct** (non-pooled) URL (see README, Deploy). |
| `JWT_SECRET` | **yes** | none | `<64 random hex chars>` | HS256 signing key for access tokens. Render generates it (`generateValue`). Local: `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `JWT_ALGORITHM` | no | `HS256` | `HS256` | Leave as is. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `60` | `60` | Access cookie lifetime. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | no | `30` | `30` | Refresh cookie lifetime when "Keep me signed in" is ticked. |
| `FRONTEND_ORIGIN` | prod: yes | `http://localhost:3000` | `https://crown-barber.vercel.app` | The only CORS origin, and the admin link inside the shop's "new request" text. No trailing slash. |
| `COOKIE_SECURE` | prod: yes | `0` | `1` | `Secure` flag on the auth cookies. Must be `1` behind https; must be `0` on plain-http localhost. |
| `TRUST_PROXY` | prod: yes | `0` | `1` | Rate limits key on the first `X-Forwarded-For` hop instead of the socket address. Turn on only behind a proxy that sets that header (Vercel, Render). Locally leave `0`. |
| `DEMO_MODE` | no | `0` | `1` | Client demo: enables `POST /api/admin/demo/reset` (owner only) and **forces SMS dry run**. |
| `CROWN_CLOCK_OVERRIDE` | no | empty | `2026-09-25T10:15:00-04:00` | Freezes shop time (validation, seed offsets, "today") for fidelity runs. Ignored when `ENV=production`. |
| `CROWN_OWNER_EMAIL` | first start: yes* | empty | `owner@example.com` | Owner account `seed.py` creates if it does not exist. |
| `CROWN_OWNER_PASSWORD` | first start: yes* | empty | `<a long password>` | Its password (only used on creation; never overwritten). |
| `CROWN_OWNER_NAME` | no | `Crown owner` | `Jane Doe` | Display name for the owner. |
| `SMS_DRY_RUN` | no | `0` | `1` | Log texts instead of sending, even with Twilio configured. |
| `TWILIO_ACCOUNT_SID` | for live SMS | empty | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Twilio account. |
| `TWILIO_AUTH_TOKEN` | for live SMS | empty | `<twilio auth token>` | Twilio auth token. |
| `TWILIO_FROM_NUMBER` | for live SMS | empty | `+15195550000` | Sending number (E.164). |
| `CROWN_SHOP_SMS_TO` | no | empty | `519-555-0000` | Shop phone that gets a text for each new online request. Empty: no shop texts. |
| `CROWN_CLOUDINARY_CLOUD_NAME` | prod: yes | empty | `my-cloud` | With the next two set, uploads go to Cloudinary. Otherwise to `MEDIA_DIR`, served at `/api/media/*`. |
| `CROWN_CLOUDINARY_API_KEY` | prod: yes | empty | `<key>` | |
| `CROWN_CLOUDINARY_API_SECRET` | prod: yes | empty | `<secret>` | |
| `MEDIA_DIR` | no | `Backend/media` | `/var/data/media` | Local upload folder (dev only; Render's disk is not persistent). |

\* `python seed.py` exits with an error when the owner account does not exist yet and these are unset.
`python seed.py --demo` falls back to the design's public demo login (`owner@crownbarbershop.ca` / `crown2026`).

**SMS dry run** is on when `SMS_DRY_RUN=1`, **or** `DEMO_MODE=1`, **or** any of the three `TWILIO_*` values is
missing. Dry-run texts are written to the API log as `SMS DRY RUN kind=... to=+1519***0100 body="..."`.

Test-only (pytest, `Backend/Tests/conftest.py`):

| Variable | Default | What it does |
|---|---|---|
| `TEST_DATABASE_URL` | `postgresql://postgres@127.0.0.1:5544/crown_test` | Database pytest drops, migrates and uses. Never point it at real data. |

## Frontend (`Frontend/.env.local` locally, Vercel project settings in production)

| Variable | Required | Default | Example (placeholder) | What it does |
|---|---|---|---|---|
| `API_ORIGIN` | prod: yes | `http://127.0.0.1:8000` | `https://crown-api.onrender.com` | Where Next forwards `/api/*` (rewrite in `next.config.ts`) and where the site's server render reads `/api/public/state`. Rewrites are compiled at build time, so set it for the **build** as well as at runtime. |
| `NEXT_PUBLIC_DEMO_MODE` | no | empty | `1` | `1` shows the demo-only UI: the demo login box, the demo "forgot password" text and "Reset demo data". Inlined at build time: rebuild after changing it. Pair it with the backend's `DEMO_MODE`. |

## End-to-end specs (`Frontend/e2e`)

| Variable | Default | What it does |
|---|---|---|
| `E2E_BASE_URL` | unset: Playwright starts `npm run start` on :3000 | Test a server that is already running, for example `http://127.0.0.1:3000`. |
| `E2E_API_LOG` | unset: SMS log check skipped (reported as an annotation) | Path of the API's log file; the booking spec waits for the dry-run confirmation line there. |
| `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD` | the demo owner | Owner login for databases not seeded with `--demo`. |
