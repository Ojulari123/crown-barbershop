# Crown Barber Shop: build plan v2 (Fable loop)

Shared paths:
- `CWD` = `/Users/jasonojulari/Library/Application Support/Claude/scratch-workspaces/f2d429e2-a153-43bf-98dd-ec06d0252e44/02812373-138d-4a58-874b-33e46fa50871/scratch-2026-09-24-81d82a`
- `ROOT` = `$CWD/crown-barber` (the new monorepo)
- `SCR` = `/private/tmp/claude-502/-Users-jasonojulari-Library-Application-Support-Claude-scratch-workspaces-f2d429e2-a153-43bf-98dd-ec06d0252e44-02812373-138d-4a58-874b-33e46fa50871-scratch-2026-09-24-81d82a/75fde853-066f-4a74-b89a-84b84f9a3d78/scratchpad`
- Design sources:
  - site: `$SCR/web-edit/src`, MagicPath `bold-shade-8845`, id 453566884927918080
  - mobile preview: `swift-dusk-8862`, id 453626418958598144 (same code as the site)
  - admin: `$SCR/admin-ctx/src`, `gladly-cliff-2542`, id 453630235984928768
- Housing reference: `/Users/jasonojulari/Desktop/Projects '26/FindYourCribb/Housing`. VNA reference: `/Users/jasonojulari/Desktop/Value-N-Action/VNA`.

## Decisions (made by Fable; the user has delegated them)

| Area | Choice | Source |
|---|---|---|
| Layout | `ROOT/Backend` + `ROOT/Frontend` monorepo, plus `docs/` and `fidelity/` | Housing |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 (**2.0 style**: `DeclarativeBase`, `Mapped`, `select`, `db.get`), psycopg2-binary, pydantic-settings, python-jose HS256, bcrypt, slowapi, APScheduler, httpx. Pinned `requirements.txt` / `requirements-dev.txt`; pytest | Housing (minus its legacy query style) |
| Backend layout | `main.py`, `config.py`, `db.py`, `tables.py`, `Routes/<domain>.py` (`<domain>_router`), `Schemas/<domain>Schema.py`, `Utils/*`, `migrations/*.sql` + `migrate.py`, `seed.py`, `Tests/` | Housing |
| Migrations | Plain SQL files run by `migrate.py`. No Alembic, no `create_all`/`ALTER` on startup | Housing's working system, without the drift |
| Database | Neon Postgres via `DATABASE_URL` (`sslmode=require`). Local verification uses a throwaway Postgres 14 cluster under `$SCR/pg` | user |
| Auth | One `staff` table with a `role` column. JWT access token (60 min) + rotating opaque refresh token (SHA-256 stored, reuse detection), both in **httpOnly SameSite=Lax cookies**. The frontend reaches the API same-origin through a Next rewrite of `/api/*` | Housing `security.py`, with its localStorage-token mess fixed |
| Rate limiting | slowapi, e.g. `5/minute` on the booking and message POSTs. `request: Request` comes first in the handler signature | Housing |
| SMS | Twilio REST via httpx in `Utils/sms.py`. Sends on: a new request (to the shop), confirm and decline (to the customer), and a 9 AM Toronto reminder for today's confirmed bookings (APScheduler). `SMS_DRY_RUN=1` (the default when Twilio variables are missing) logs instead of sending | new |
| Images | Cloudinary when `CROWN_CLOUDINARY_*` are set; otherwise local `Backend/media/`, served at `/api/media/*` (dev only) | Housing/VNA |
| Time | All shop logic runs in `ZoneInfo("America/Toronto")`: `date` + minutes-after-midnight, exactly as in the design | Housing had no time-zone handling; fixed here |
| Frontend | Next.js 16 App Router, React 19, TS strict, Tailwind v4 (`@tailwindcss/postcss`), framer-motion 12, lucide-react, clsx, tailwind-merge. **No** Zustand, sonner or UI kit: the design already ships its own toast, kit and store | Housing, trimmed to what the design needs |
| Fonts | Bodoni Moda (opsz, 400–700, plus italic), Barlow Condensed 500/600, Libre Franklin 400/500/600, loaded in MagicPath (Phase 0) **and** through `next/font` | Fable (fixes the unloaded fonts) |
| Content | Keep every placeholder photo and text (client demo). Demo seed = the design's sample data | user |
| Hosting | Frontend on Vercel, backend on Render (`Procfile` + `render.yaml`, single instance because of the scheduler), Neon database | VNA / CC-Platforms |

### Data-layer strategy (key to 1-to-1)
The design components call `useCrown()` and `setSlice()` from `store.ts`. We **keep that API**, so the ported components stay almost verbatim, and swap only the internals:
- **Site:** `useCrown()` is hydrated from `GET /api/public/state`: services, barbers, hours, closures, notice, gallery, plus a `bookings` slice holding only `{date, time, barberId, status}` for live bookings in the next 60 days. That slice contains no personal information, so the design's `isSlotTaken` keeps working. Booking or messaging goes through `POST /api/public/bookings` and `POST /api/public/messages`. The server re-validates hours, closures and double-booking under a row lock / partial unique index.
- **Admin:** `useCrown()` is hydrated from `GET /api/admin/state` (full data). `setSlice(key, next)` applies optimistically, then syncs:
  - config slices (`services`, `barbers`, `hours`, `closures`, `notice`) go out as a `PUT` of the whole slice;
  - entity slices (`bookings`, `messages`, `gallery`) are diffed by id and sent as `POST`, `PATCH` or `DELETE`;
  - a failed sync rolls back and returns `{ok:false}`.

---

## Workstreams

### E0: Design freeze + fidelity oracle (parallel with E1)
Owns `ROOT/design-snapshot/` and `ROOT/fidelity/`, and edits the MagicPath canvas.
1. Load the fonts in MagicPath. For each of the three components run `magicpath-ai code start --component <id> --dir $SCR/font-<name> -o json`. Change line 1 of `src/index.css` to `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Libre+Franklin:wght@400;500;600&display=swap');` and change nothing else. Then run `code submit --wait`. Verify in a real browser on the preview URL: `document.fonts.check('16px "Bodoni Moda"')` and the Barlow Condensed equivalent are both true.
2. Snapshot. Run `code context` for the site and admin components and copy their `src/` into `ROOT/design-snapshot/{site,admin}/`. Write `ROOT/design-snapshot/REVISIONS.md` with the revision IDs and the date.
3. Build the oracle in `ROOT/fidelity/`: its own `package.json` with Playwright, pixelmatch, pngjs and tsx.
   - `capture.ts --target magicpath|local --out <dir>` and `compare.ts <a> <b> --out diff/` (per-image % diff plus overlay PNGs).
   - Settings: frozen clock `2026-09-25T10:15:00-04:00` (`page.clock.setFixedTime` or install before navigation), `reducedMotion: 'reduce'`, viewports 390×844 and 1280×800 (plus 768 and 1440 for the site home).
   - Close the MagicPath banner. Handle the preview's **body-scroll** quirk so full-page captures are comparable (for example, inject CSS that makes html/body/#root `height:auto; overflow:visible`), and document the approach.
   - Targets:
     - `magicpath`: `https://api.magicpath.ai/v1/bold-shade-8845#/<route>` and `.../gladly-cliff-2542#/<route>`
     - `local`: `http://127.0.0.1:3000/<route>` and `/admin/<route>`
   - Site shots: every route (`/`, `/prices`, `/book`, `/gallery`, `/about`, `/visit`, 404), menu open, lightbox open, the Prices "Shaves & beards" tab, FAQ item 2 open, and each booking step (service → barber → day → time → details → done, using Skin fade, Tania, Friday Sep 25, the first time slot, and name "Test Client" / phone 5195550100).
   - Admin shots: login, then (after demo login `owner@crownbarbershop.ca` / `crown2026`) Today, Bookings (each tab plus the first drawer), Messages, Gallery, Team, Prices, Hours, Settings.
   - Drive states with role/text selectors so one script works on both targets.
4. **Pass:** two MagicPath captures in a row give 0.00% diff on every image. The baselines are saved in `fidelity/baseline/`, and a README explains how to run the oracle.

### E1: Plan validation + API contract (parallel with E0; documents only, no app code)
Owns `ROOT/docs/`.
- Read this plan, `$SCR/web-edit/src/**` and `$SCR/admin-ctx/src/**`. Enumerate **every** `useCrown`, `setSlice`, `resetDemo` and `storageUsedKb` call site and every derived helper, and map each one to an endpoint and payload.
- Write:
  - `docs/api-contract.md`: endpoints, request/response JSON (camelCase, matching the TS types in `store.ts`), auth, status codes, rate limits.
  - `docs/schema.md`: tables, columns, indexes, including the partial unique index for live bookings on `(barber_id, date, time)` and first-available capacity rules.
  - `docs/decisions.md`: this plan's decisions plus anything you changed and why.
  - `docs/validation.md`: every problem found in this plan (gaps, contradictions, infeasible steps) with a fix.
- Specifically check:
  - admin screens that mutate several slices at once;
  - undo toasts;
  - CSV export;
  - image upload paths (base64 today → multipart upload returning a URL);
  - how demo-only features ("Reset demo data", "Remove samples", demo login box) should behave: keep them behind `DEMO_MODE=1`, since this build is a client demo;
  - the `sample` flags;
  - "first available" booking resolution to a real barber;
  - public data leakage.
- **Pass:** every call site listed with file:line and mapped. No endpoint left undefined.

### E2: Backend (after E1)
Implements `docs/api-contract.md` and `docs/schema.md` in `ROOT/Backend/`, following the Housing conventions above. Includes `seed.py` (`--demo` seeds the design's sample data relative to `--today`, defaulting to Toronto today; always seeds the real shop facts and one owner account) and the Twilio dry-run. Tests in pytest against the local Postgres cluster cover: auth + refresh rotation, public state not leaking PII, booking validation (hours, closures, past times, double-booking under concurrent requests), admin CRUD for each slice, and SMS dry-run calls. **Pass:** `pytest` is green; `python migrate.py up` works on an empty database; a manual curl walk-through of booking → confirm is logged.

### E3: Frontend scaffold + site (after E1; parallel with E2)
`ROOT/Frontend/`.
- Next 16 app, `globals.css` copied verbatim from the snapshot (site CSS plus the admin token block), fonts via `next/font`.
- `src/lib/{store.ts (adapter), data.ts, api.ts, links.ts}`.
- The site components are ported verbatim into `src/components/site/`, with routes under `src/app/(site)/`: hash links become paths, `PAGES` titles move into metadata, JSON-LD is kept, and the page transition goes in `template.tsx`.
- `next.config.ts` rewrites `/api/*` to `API_ORIGIN` (default `http://127.0.0.1:8000`).
- No hydration warnings.
- **Pass:** `npm run build` and `tsc --noEmit` are clean. With E2's backend (or a stub matching the contract if E2 isn't done), the site renders with data. Fidelity compare on the site shots ≤0.5% per image, and every larger diff is explained.

### E4: Admin port (after E3)
`src/components/admin/`, `src/app/admin/*`.
- Login posts to the auth API. Middleware plus a client guard protect `/admin`.
- Demo features only when `NEXT_PUBLIC_DEMO_MODE=1`.
- The admin link in the site footer points to `/admin`.
- **Pass:** build is clean; admin fidelity ≤0.5% per image; a real browser walk-through of confirm → undo, logging a walk-in, a price edit that appears on the site, uploading a photo, and adding a day off.

### E5: Integration, cleanup, deploy (after E2–E4)
- End-to-end Playwright on the real stack (booking on the site → appears in the admin → confirm → SMS dry-run logged).
- Full fidelity run.
- Remove dead code and duplication (for example, one `Calendar.tsx`, no unused design files such as `PHOTOS.pole`).
- `README.md` (run, seed, test, deploy), `docs/env.md` (every variable), `render.yaml`, `Backend/Procfile`, `Frontend/vercel.json` if needed, `.github/workflows/ci.yml` (pytest on Postgres 16, `tsc`, `next build`).
- **Pass:** a clean-clone run following the README works end to end.
