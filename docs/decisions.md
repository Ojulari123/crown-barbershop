# Decisions

Part 1 restates the plan's decisions (made by Fable, delegated by the user). Part 2 lists what E1 added or changed while writing the contract, each tied to a finding in `validation.md`. Anything marked **open** needs the user.

## Part 1: plan decisions (unchanged)

| Area | Choice |
|---|---|
| Layout | `Backend/` + `Frontend/` monorepo, plus `docs/`, `fidelity/`, `design-snapshot/` |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 style, psycopg2-binary, pydantic-settings, python-jose HS256, bcrypt, slowapi, APScheduler, httpx; pinned requirements; pytest |
| Backend layout | `main.py`, `config.py`, `db.py`, `tables.py`, `Routes/<domain>.py` (`<domain>_router`), `Schemas/<domain>Schema.py`, `Utils/*`, `migrations/*.sql` + `migrate.py`, `seed.py`, `Tests/` |
| Migrations | Plain SQL via `migrate.py`; no Alembic, no startup DDL |
| Database | Neon Postgres (`DATABASE_URL`, `sslmode=require`); local Postgres 14 under `$SCR/pg` |
| Auth | One `staff` table with `role`; 60-min JWT access token and rotating opaque refresh token (SHA-256 stored, reuse detection) in httpOnly SameSite=Lax cookies; same-origin through Next rewrite of `/api/*` |
| Rate limiting | slowapi, `request: Request` first |
| SMS | Twilio REST via httpx; new request → shop, confirm/decline → customer, 9 AM Toronto reminder; dry run by default without Twilio vars |
| Images | Cloudinary when `CROWN_CLOUDINARY_*` set, else local `Backend/media/` at `/api/media/*` (dev) |
| Time | `ZoneInfo("America/Toronto")`, `date` + minutes after midnight |
| Frontend | Next 16 App Router, React 19, TS strict, Tailwind v4, framer-motion 12, lucide-react, clsx, tailwind-merge; no Zustand/sonner/UI kit |
| Fonts | Bodoni Moda, Barlow Condensed, Libre Franklin in MagicPath and via `next/font` |
| Content | All placeholder photos/text kept; demo seed = design sample data |
| Hosting | Vercel (frontend), Render single instance (backend), Neon |
| Data layer | Keep `store.ts` API; site hydrates from `GET /api/public/state`; admin from `GET /api/admin/state`; config slices PUT whole, entity slices diffed by id |

## Part 2: E1 decisions and changes

| # | Decision | Why | Finding |
|---|---|---|---|
| D1 | `setSlice` stays **synchronous** and returns optimistic `{ok:true}`. The two site writes use new awaited `createBooking()` / `sendMessage()`. Admin failures resync from the server and show one global error toast via `onSyncError`. `SaveResult.reason` widened to add `taken, invalid, rate, auth`. | A network outcome cannot be returned synchronously; a Promise return would make the site show "done" on failure. Keeping admin calls sync lets 19/21 admin writes port verbatim. **Changes the plan's "rolls back and returns `{ok:false}`".** | V1, V11 |
| D2 | Cookies: `crown_access` (Path=/), `crown_refresh` (Path=/api/auth), hint cookie `crown_signed_in=1` (not httpOnly, no secret) for Next middleware. Non-GET auth/admin calls need `X-Crown: 1`. "Keep me signed in" = persistent vs session refresh cookie. | Middleware cannot see `/api`-scoped cookies and must not loop on the 60-min access expiry. The header adds CSRF defence on top of Lax. | V2, V14 |
| D3 | Site state is fetched server-side in the `(site)` layout and passed to `CrownProvider initial`; the client singleton is primed before children render. Admin renders the Portal only after admin state loads. The server never writes the module singleton. | Mount-time `useState` snapshots; no hydration warnings; no cross-request leakage. | V3 |
| D4 | Serialization contract: TS key order, omit NULL optionals, whole prices as integers, NULL ≠ `''`/`[]`; the adapter does not overwrite local state with write responses. | `JSON.stringify` dirty checks. | V4 |
| D5 | **First available is stored as `barberId: 'any'`**, not resolved to a named barber. Capacity guarantees a free chair; the shop reassigns by editing. | Matches design display, sample data and admin form default; resolving would change admin fidelity. **Deviates from the plan's "resolution to a real barber".** | V12 |
| D6 | Double-booking: `pg_advisory_xact_lock` per date and a count in the transaction for public bookings; partial unique index `(barber_id, date, time) WHERE status IN ('requested','confirmed') AND barber_id <> 'any'` as backstop. | There is no slot row to lock; `any` capacity is a count; walk-ins (`done`, 5-min rounding) would collide under a "not cancelled" index. **Narrows the plan's index predicate.** | V5, V6 |
| D7 | Capacity rule is exact parity with `isSlotTaken` (start times only, `status <> 'cancelled'` counts). | The server must never refuse a slot the site offers, or accept one it hides. | V13 |
| D8 | SMS goes through `sms_outbox`. Confirm/decline wait 10 s and are cancelled by a later status change. Confirm = `requested → confirmed`, decline = `requested → cancelled`, only `source='online'`. Reminder cron 09:00 Toronto, unique per booking and day. Sample bookings never send. Copy in api-contract.md section 6. | Undo toast is 6 s; duplicates from multiple workers; the design distinguishes Decline from Cancel. | V7, V17, V26 |
| D9 | `DEMO_MODE=1` (backend) enables `POST /api/admin/demo/reset` and **forces SMS dry run**. `NEXT_PUBLIC_DEMO_MODE=1` (frontend) shows the demo login box, the demo forgot text and the Reset block. "Remove samples" is data-gated, not flag-gated. | Public demo credentials plus live texting is an abuse path. Samples only exist when seeded with `--demo`. | V10, V22 |
| D10 | `CROWN_CLOCK_OVERRIDE` (ISO instant, ignored when `ENV=production`) and `seed.py --now` next to `--today`. | Fidelity freezes the browser clock; server validation and seed offsets must use the same instant. **Adds to the plan's seed interface.** | V9 |
| D11 | Gallery delete is a soft delete; `POST` with a soft-deleted id restores it (keeps `sample`). `createdAt` is PATCHable. | Undo, remove-samples undo, and reorder by `createdAt` swap. | V16 |
| D12 | `text` ids. Admin creates keep client ids; public creates get server ids. | Diff-sync matches by id; the public never needs the id. | V18 |
| D13 | No foreign keys from bookings to services/barbers. The `any` barber row is mandatory and cannot be dropped by PUT. | "Existing bookings stay"; "Removed service" display. | V19 |
| D14 | Uploads: the adapter converts `data:` URLs into multipart `POST /api/admin/uploads` and swaps in the returned URL before the gallery POST / barbers PUT. The server rejects `data:` values. Cloudinary via signed REST upload with httpx (no SDK). | Components keep their client-side shrink code unchanged; no new dependency; no orphans from discarded drafts. | V20 |
| D15 | CSV export stays client-side from admin state; `GET /api/admin/state` returns every booking. Recommended (not required) one-line formula-escape fix in `SettingsAdmin.tsx` `esc()`. | Matches the design; the count on the button stays right. | V21 |
| D16 | One FIFO sync queue for all slices; config PUTs coalesced; notice `null` → `DELETE /api/admin/notice`; admin polls every 30 s and on focus, skipped while writes are pending. | Ordering of rapid edits and undo; the lost `storage`-event live sync. | V15, V29 |
| D17 | Admin booking writes validate shape only (plus the unique index); public writes run the full hours/closure/past/window/capacity list. | The admin form and walk-in flow already encode staff judgment; walk-ins can fall outside hours. | V30 |
| D18 | Public state: visible services only; closures `>= today`; slots `{date,time,barberId,status:'confirmed'}` for non-cancelled bookings in `[today, today+60]`; no messages; no `sample` on photos. | Least data needed for the site to behave identically. | V27 |
| D19 | Roles: `owner` and `staff` share all admin routes except demo reset (owner). | The design has one account type; keep the column for later. | — |
| D20 | Error envelope `{"detail": {"code", "message"}}`; 422 validation left as FastAPI default. | Adapter maps by status code; FastAPI-native. | — |
| D21 | Rate-limit key is the first `X-Forwarded-For` hop when `TRUST_PROXY=1`. Limits: bookings and messages `5/minute;20/hour`, login `10/minute`, refresh `30/minute`, uploads `60/minute`, public state `120/minute`, demo reset `5/minute`. | Behind Vercel and Render every request otherwise shares one IP. | V8 |
| D22 | Port from `design-snapshot/` (E0), not `web-edit`; re-run the call-site generator on the snapshot before porting. | The local design copies have diverged. | V25 |

### Open questions (not decided by E1)
1. Should cancelling a **confirmed** booking text the customer (D8 sends nothing)? (V17)
2. Is the public demo URL allowed to take real customer bookings? If yes, it needs `DEMO_MODE=0` and a private owner password (V10).
3. Copy for `Login.tsx:120` and `SettingsAdmin.tsx:45` when `DEMO_MODE=0` (V22).
4. CASL/consent review before real SMS sending (V35).

## Backend deviations (E2)

| # | Deviation | Why |
|---|---|---|
| B1 | Cancelling a **confirmed** online booking (`confirmed → cancelled`) queues a customer text, kind `cancelled`, with the same 10 s grace and undo-cancellation as confirm/decline. `sms_outbox.kind` CHECK gains `'cancelled'`. Copy: `Crown Barber Shop: sorry, your chair for {when} has been cancelled. Walk-ins are always welcome, or call (519) 763-2229 to find another time.` Phone/walk-in bookings still never text (same `source='online'` rule as D8). | Fable resolved open question 1 (V17) in the E2 brief: cancellation of a confirmed booking does text the customer. The copy is new (not in the design); derived from the declined text. |
| B2 | `seed.py` inserts defaults and the owner **only when missing** (`ON CONFLICT DO NOTHING`); it never overwrites owner-edited services/barbers/hours or an existing password. Demo reset is the only path that restores design defaults. | schema.md says "idempotent upsert"; overwriting on every run would undo the owner's edits in production. |
| B3 | Outbox timing (`send_after`, grace, retries) uses the real UTC clock, not `CROWN_CLOCK_OVERRIDE`. Shop logic (validation, `createdAt` of public writes, reminders' "today", seed offsets) uses `now_toronto()`. | A frozen shop clock would otherwise strand every graced row in the future or past. |

## Part 4: Frontend deviations (E3/E4)

| # | Deviation | Why |
|---|---|---|
| F1 | Portrait photos (TeamAdmin) are uploaded when picked (`uploadImage(await toPhoto(f), 'portrait')`), so the draft holds the stored URL. Gallery photos still go data: URL → adapter upload, as in the contract (section 5). | With the contract's upload-at-save plus local URL swap, TeamAdmin's draft keeps the data: URL while `crown.barbers` gets the URL, so the page showed "Unsaved changes" right after Save. Cost: a portrait picked and then discarded leaves an unreferenced upload (not counted in `mediaKb`). |
| F2 | Page transitions live in `template.tsx` (site and admin) and are enter-only; the design's exit fade (0.14 s site, 0.1 s admin) is dropped. First load has no transition, as with the design's `AnimatePresence initial={false}`. | Next remounts `template.tsx` per navigation; an exiting copy of a layout's `children` would already show the new page. |
| F3 | `useReducedMotion` for site components comes from `src/lib/motion.ts` (false during SSR and hydration, then the real preference). `Reveal` in `ui.tsx` is keyed on it, so it remounts once for reduce-motion users. | framer's hook reads matchMedia on the first client render, which mismatches the server HTML for reduce-motion users; without the remount, below-the-fold Reveals would stay hidden until scrolled into view. |
| F4 | While the site hydrates, `torontoNow()`/`ymdPlus()` use the server's render time (`data.ts pinClock`), then the device clock. | Time-dependent text (today's hours, notices, calendars) would otherwise mismatch the server HTML whenever server and browser clocks disagree (the fidelity run freezes the browser clock). |
| F5 | Same-origin `<a href="/...">` clicks on the site are turned into client-side navigations by a document click listener in the site shell (design markup unchanged); `/admin` and `/api` stay full loads. | Keeps the design's plain anchors (and `Pill href`) verbatim while avoiding full reloads, as the hash router did. |
| F6 | Next 16 `proxy.ts` (not `middleware.ts`) gates `/admin/*` on the `crown_signed_in` hint cookie; the portal then checks `GET /api/auth/me`. The login page asks `/api/auth/me` only if the hint cookie exists (no 401 console noise). | `middleware.ts` is deprecated in Next 16 and warns at build. |
| F7 | `signIn()` maps every failure (401, 429, network) to the design's "That email and password do not match" message. | Login.tsx has one error slot and copy; a new message would change the design. Rate-limit or outage looks like a wrong password. |
| F8 | "Forgot password?" still toggles, but its demo text only renders with `NEXT_PUBLIC_DEMO_MODE=1` (per contract 8.9), so with demo mode off the button shows nothing. | Open question 3 (non-demo copy) is still open. |
| F9 | CSV `esc()` prefixes `'` to cells starting with `= + - @ tab CR` (V21). | Formula injection from the public booking form. Numbers that start with `+` (e.g. `+1 519…`) appear with a leading apostrophe in the CSV. |
| F10 | `LOGO_SRC` moved from `ui.tsx` to `data.ts` (ui.tsx imports it). Favicon comes from root metadata instead of the design's `link[rel=icon]` effect; titles come from route metadata instead of `document.title`. | A server layout cannot read constants from a `'use client'` module. |
| F11 | The site SSR fetch of `/api/public/state` forwards the visitor's `X-Forwarded-For`. | With `TRUST_PROXY=1` every page render would otherwise count against the Next server's IP (120/minute). |
| F12 | clsx and tailwind-merge are not installed. | Nothing uses them; the design ships its own `cx()`. |

## Part 5: integration deviations (E5)

| # | Deviation | Why |
|---|---|---|
| I1 | MagicPath fonts load through a module-level `<link id="crown-fonts">` in each component's `App.tsx` (same css2 URL), not line 1 of `index.css`. | Submitted twice: MagicPath rewrites line 1 back to Libre Franklin only, and collapses appended `@font-face` rules (Bodoni Moda became one 400/normal face). The `App.tsx` link survives and loads every face. See `design-snapshot/REVISIONS.md`. |
| I2 | No production font change. | Next 16 `next/font` already registers the real family names (`--font-display: "Bodoni Moda", Didot, Georgia, serif`) on `<body>`; `fidelity/fonts-check.ts` passes on `/` and `/admin/login`. |
| I3 | `seed.py` without `--demo` and without `CROWN_OWNER_*` now succeeds when an owner already exists (it still exits with an error on a database with no owner). | Render runs `python seed.py` on every start; previously every restart failed unless the owner password stayed in the environment forever. |
| I4 | `@next/next/no-html-link-for-pages` is off for `src/components`. | Plain `<a href>` is the design's markup and F5 handles those clicks; `next/link` would change the port. |
| I5 | Removed dead code: `calendarDate` (Calendar.tsx), `viewLabel` (CrownShopAdmin.tsx), `Count` (admin kit.tsx), `require_owner` (Backend security.py), fidelity `_probe.ts` and `@types/pixelmatch` (pixelmatch 7 ships types). | Unreferenced in the port and in the design snapshot. |
| I6 | Not deduplicated: `publicState.ts fallback()` vs `store.ts defaults()`, and the shop facts in `Frontend/src/lib/data.ts` vs `Backend/shop.py`. | `store.ts` is `'use client'`, so a server module cannot call into it; the frontend copy is the offline fallback and the barber-bio fallback, the backend copy is the seed. |
