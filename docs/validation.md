# Plan validation (E1)

Scope: `CROWN_REBUILD_PLAN.md` v2 checked against the design sources `$SCR/web-edit/src/**` and `$SCR/admin-ctx/src/**` (line numbers below are from those copies), and against Housing's backend conventions. Every item has a severity, the evidence, and the fix adopted in `api-contract.md` / `schema.md` / `decisions.md`.

Severity: **H** breaks a pass criterion, correctness or security if ignored. **M** causes visible bugs or rework. **L** is cleanup or a product question.

---

## Verdict: does "keep the store.ts API, swap internals" let components port verbatim?

**Mostly, not entirely.** Reads port verbatim; most admin writes port verbatim; ten files need small, listed edits (seven for logic or gating, three only because their "View on site" links use `${SITE_URL}#/...` hash paths: `GalleryAdmin.tsx:122`, `PricesAdmin.tsx:134`, `TeamAdmin.tsx:128`).

Ports verbatim (given the adapter rules in api-contract.md section 8):
- All **25 `useCrown()` reads** (11 site, 14 admin), provided state is present before first render (V3) and the server's JSON matches the design's key order (V4).
- **19 of the 21 admin `setSlice()` calls.** They are fire-and-forget or only check `r.reason === 'full'`, so an optimistic `{ok:true}` is compatible.
- All pure helpers (`callsites.md` section B), `resetDemo()`, and `storageUsedKb()` (sync signatures kept).

Needs edits (not verbatim):

| File | Why | Size of edit |
|---|---|---|
| `site/Booking.tsx:144-187` | relies on the **synchronous** return of `setSlice` (`:166`, `:180`) inside a fake 700 ms timeout; the real outcome (409 slot taken) is async | `submit` becomes async; `await createBooking(...)`; branch on `res.reason === 'taken'` using the design's own copy at `:158` (V1) |
| `site/Visit.tsx:171-199` | same pattern at `:185`, `:194` | `await sendMessage(...)` (V1) |
| `admin/CrownShopAdmin.tsx:71-101` | **reads/writes `localStorage`/`sessionStorage` directly** for the session (`:73`, `:92`, `:98`, `:99`), bypassing the store; hash navigation (`:67-70`) | session from `GET /api/auth/me`; sign-out via `POST /api/auth/logout`; mount `<SyncErrorToasts/>` in `ToastProvider` (`:96`); routes instead of hash (V2) |
| `admin/Login.tsx:18-23`, `:120`, `:133-140` | `signIn()` checks credentials in the browser; demo box always shown | `signIn` → `POST /api/auth/login`; demo box and demo forgot text only when `NEXT_PUBLIC_DEMO_MODE=1` (V2, V10) |
| `admin/SettingsAdmin.tsx:55-60` | "Reset demo data" block always shown; copy says data lives in the browser | render only in DEMO_MODE (V22); optional one-line CSV escape fix (V21) |
| `admin/kit.tsx:9` + 10 `SITE_URL` uses | hard-coded MagicPath URL with `#/` hash paths (for example `PricesAdmin.tsx:134` `${SITE_URL}#/prices`) | `SITE_URL = ''` plus path links (V23) |
| `site/Footer.tsx:7`, `:70` | `ADMIN_URL` hard-coded to MagicPath | `/admin` (already in the plan) |
| `admin/GalleryAdmin.tsx:76`, `TeamAdmin.tsx:88`, `Bookings.tsx:245` | `reason === 'full'` error branches can no longer fire | **no edit required**: dead but harmless; failures surface through the global sync-error toast (V1) |

No component calls `fetch`, reads the store's localStorage keys, or uses `FileReader` directly (grep counts: `fetch(` 0, `FileReader` 0, `crown:v1` outside store.ts 0). The only other browser-storage access is the admin session above.

---

## Findings

### V1 (H). Site writes depend on a synchronous `setSlice` result
Evidence: `Booking.tsx:165-186` calls `setSlice('bookings', ...)` in a `setTimeout`, then `if (!res.ok && res.reason === 'full')` or `setStep('done')`. `Visit.tsx:184-200` is the same. The plan says "a failed sync rolls back and returns `{ok:false}`", but a network result cannot be returned synchronously. If `setSlice` returned a Promise instead, `res.ok` would be `undefined`, `res.reason === 'full'` false, and **the site would show "done" even when the server rejected the booking**.
Admin side: `GalleryAdmin.tsx:75-76`, `TeamAdmin.tsx:82-88`, `Bookings.tsx:240-245` check `reason === 'full'` synchronously; those branches can never fire against a server.
Fix: `setSlice` keeps its sync signature and returns the optimistic `{ok:true}`. New `createBooking()` / `sendMessage()` return `Promise<SaveResult>` and are awaited in the two site components (api-contract.md 8.6). Admin failures go through `onSyncError` → one global error toast plus a resync (8.3). `SaveResult.reason` is widened with `'taken' | 'invalid' | 'rate' | 'auth'`.

### V2 (H). The admin session bypasses the store
Evidence: `CrownShopAdmin.tsx:66` `KEY = 'crown:admin:session'`, `:73` read, `:92` write (`remember ? localStorage : sessionStorage`), `:98-99` remove. `Login.tsx:18-23` compares against `DEMO_ACCOUNT` in the browser.
Fix: cookies only (api-contract.md section 2). `remember` maps to a persistent vs session refresh cookie. `readSession()` becomes `GET /api/auth/me`. The Session shape `{email, name}` is kept (plus `role`).

### V3 (H). Components copy state into `useState` at mount, so the first render must already have server data
Evidence: `TeamAdmin.tsx:63-64` `useState(crown.barbers)`, `PricesAdmin.tsx:85` `useState(saved)`, `HoursAdmin.tsx:73` `useState(saved)`, `:176-177` notice text/until, `Bookings.tsx:316` initial tab from `crown.bookings`. With async hydration they would initialize from empty defaults and the `dirty` flags and "Unsaved changes" guard would misfire. On the site, an empty first render also means no SSR content, a layout jump, and a likely hydration mismatch (plan E3 requires none).
The plan does not say how the first render gets data.
Fix: site: server-side fetch in the `(site)` layout, `CrownProvider initial={...}` primes the client singleton before children render; `getServerSnapshot` returns `initial` (8.1). Admin: Portal renders only after `GET /api/admin/state` resolves. Never prime the module singleton on the server (it would be shared across requests; for admin data that is a PII leak).

### V4 (H). Dirty checks compare `JSON.stringify` output, so the wire format must match the design byte for byte
Evidence: `TeamAdmin.tsx:67`, `PricesAdmin.tsx:87`, `HoursAdmin.tsx:75`. If a poll/resync returns barbers with `"photo": null`, or keys in another order, or `34.0`, the page shows "Unsaved profile changes" with nothing edited.
Fix: api-contract.md section 0: TS key order, `exclude_none`, integer prices when whole, NULL ≠ `''`/`[]`. The adapter does not overwrite local state with successful write responses. E2 test: `PUT` then `GET` returns a byte-identical slice for services, barbers, hours.

### V5 (H). "Row lock" has nothing to lock, and first-available capacity cannot be a unique index
Evidence: the plan says "row lock / partial unique index". Housing locks an existing `ViewingSlot` row (`Routes/viewing.py:197` `with_for_update()`); Crown has no slot table. The `any` rule (`store.ts:332`: `live.length >= realBarbers`) is a count, which no unique index can enforce.
Fix: `pg_advisory_xact_lock(hashtext('crown:day:' || date))` plus a count in the same transaction; the partial unique index is only a backstop for named barbers (schema.md section 2). E2's concurrency test should fire N parallel `any` requests at one slot with one real barber and expect exactly one 201.

### V6 (H). A "live bookings" unique index would break logging walk-ins
Evidence: the design's "live" means `status !== 'cancelled'` (`store.ts:330`). Walk-ins are inserted as `status: 'done'` at `n.minutes - n.minutes % 5` for the first real barber (`Today.tsx:358-377`). Two walk-ins within the same 5 minutes (parent and child) would get the same `(barber_id, date, time)`, and the second "Log walk-in" would fail.
Fix: index predicate `status IN ('requested','confirmed') AND barber_id <> 'any'` (schema.md). Public capacity still counts `done`/`no-show` for parity.

### V7 (H). Undo and SMS conflict
Evidence: every status change shows a 6-second undo toast (`Bookings.tsx:36-41`, `kit.tsx:519`). The plan sends the confirm/decline SMS on the status change. Confirming by mistake and pressing Undo would still text the customer.
Fix: `sms_outbox` with `send_after = now + 10 s` for confirm/decline, cancelled by any later status change (api-contract.md section 6, schema.md).

### V8 (H). Rate limits would be shared by every visitor behind the proxies
Evidence: Housing's limiter keys on `get_remote_address` (`Utils/rate_limit.py`). In this plan every browser request goes browser → Vercel (Next rewrite) → Render. The backend's `request.client.host` is a proxy address, so `5/minute` on bookings would apply to **the whole site**, not per visitor.
Fix: key function uses the first `X-Forwarded-For` hop when `TRUST_PROXY=1` (api-contract.md section 0). **Not verified:** that Vercel external rewrites forward the real client IP in `X-Forwarded-For` and pass `Set-Cookie` back unchanged. E3/E5 must check both on a preview deploy. Also not solved: a caller can hit the Render URL directly with a forged `X-Forwarded-For`. Acceptable for a demo; the real fix is a shared-secret header added by Next middleware.

### V9 (H for fidelity). The frozen browser clock and the real server clock disagree
Evidence: E0 freezes the browser at `2026-09-25T10:15:00-04:00` and books "Friday Sep 25, first slot". The server validates past times and the 60-day window with its own clock, and `seed.py --today` alone cannot set `createdAt` offsets (`timeAgo` in the admin shows "40 min ago" for `sample-m0`, `store.ts:173`). Once the real date passes Sep 25 2026, the booking-flow capture fails at "done", and admin "Today" shows different data from the MagicPath baseline.
Fix: `CROWN_CLOCK_OVERRIDE` (ignored when `ENV=production`) and `seed.py --now`. Fidelity runs set both to the frozen instant (decisions.md D10).

### V10 (H). A public demo with public credentials exposes customers' personal data and allows SMS abuse
Evidence: the login screen prints the demo credentials (`Login.tsx:133-140`), and the plan deploys this demo publicly with a working booking form. Anyone can sign in and read every name, phone number and note. Anyone can also confirm a booking made with someone else's number and send that person a text.
Fix (partial, by decision): `DEMO_MODE=1` forces SMS dry run (D9). Remaining risk, **for the user to decide**: the demo URL must not be given to real customers. Taking real bookings needs `DEMO_MODE=0` and a private owner password. Flagged, not solved.

### V11 (M). Plan contradiction: "rolls back and returns `{ok:false}`"
Same root cause as V1: the return value is gone by the time the request fails. Rollback is therefore a resync from the server (api-contract.md 8.3), not a return value.

### V12 (M). Plan asks for "first available" to resolve to a real barber; the design keeps `any`
Evidence: `describe()` shows "First available" for `any` (`Bookings.tsx:17`); sample bookings use `any` (`store.ts:143,145,146,149`); the admin form defaults to `barbers[0]`, which is `any` (`Bookings.tsx:186`).
Fix: store `any`; capacity guarantees a free chair (D5). Resolving at insert time would change the admin fidelity shots and take the choice away from the shop.

### V13 (L, product). Only exact start times collide
Evidence: `isSlotTaken` compares `b.time === time` only; the site grid is 30 min, the admin grid 15 min (`Bookings.tsx:210`), and services last 20–50 min. A 50-minute booking at 10:00 does not block 10:30 for the same barber.
Fix: the server keeps exact parity, so the site never offers a slot the server refuses. Changing this is a product decision for later.

### V14 (M). Cookie path vs. Next middleware
Evidence: the plan puts "middleware plus a client guard" on `/admin`. Cookies scoped to `/api` are invisible to middleware on `/admin/*`. The 60-minute access cookie would expire and send a still-signed-in user to login.
Fix: `crown_access` on `Path=/`, `crown_refresh` on `Path=/api/auth`, plus a non-secret `crown_signed_in=1` hint cookie for the middleware (api-contract.md section 2).

### V15 (M). Cross-tab live updates disappear
Evidence: `store.ts:256-264` listens to `storage` events, so a site booking appears in the admin instantly in the demo. Nothing in the plan replaces that, and new online requests would not show up until reload.
Fix: 30-second poll plus refetch on focus, suspended while writes are in flight (8.1).

### V16 (M). Hard delete would break gallery undo
Evidence: `GalleryAdmin.tsx:93-97` (remove + undo re-adds the same object) and `:233-239` (remove all samples + undo restores `before`). With diff-sync that is DELETE followed by POST of the same id and URL. If DELETE also destroyed the Cloudinary asset, the restored photo would be a broken image.
Fix: soft delete, and POST with a soft-deleted id restores it (api-contract.md 4.7, 4.9). Reorder swaps `createdAt` (`:103-111`), so `createdAt` is PATCHable.

### V17 (M). SMS triggers are under-specified against the design
Evidence: the design has two different cancel actions: "Decline" (requested) and "Cancel booking" (confirmed) (`Bookings.tsx:96-100`, `:126-127`). The plan names only "decline". The site copy promises a **call**: "The shop will call {phone} to confirm." (`Booking.tsx:469`), "Only used to confirm or reschedule." (`:430`).
Fix (narrow reading): confirm SMS on `requested → confirmed`, decline SMS on `requested → cancelled`, both only for `source = 'online'`; nothing on `confirmed → cancelled`, nothing for messages or admin-created bookings. Site copy is unchanged (texts supplement the call). **Open question for the user:** should cancelling a confirmed booking text the customer?

### V18 (M). Ids are generated in the browser
Evidence: `uid()` at `Booking.tsx:167`, `Visit.tsx:186`, `Today.tsx:366`, `Bookings.tsx:242`, `GalleryAdmin.tsx:61`, `TeamAdmin.tsx:97`, `PricesAdmin.tsx:119`. Diff-sync matches by id, so the server must keep them.
Fix: `text` ids with a format check. Admin creates keep the client id; public creates get a server id (the public never needs it back).

### V19 (M). The `any` pseudo-barber lives in the barbers slice, and deletions must not orphan-fail
Evidence: `data.ts:62`; `TeamAdmin.tsx:63-64,75` edit the full list including `any`; `TeamAdmin.tsx:260` "Existing bookings stay"; `Bookings.tsx:14` "Removed service".
Fix: `any` is a real row that a PUT cannot drop; no foreign keys from `bookings` to services/barbers (schema.md).

### V20 (M). Local media on Render is ephemeral; Cloudinary is not in the dependency list
Evidence: the plan's fallback is `Backend/media/`. Render's filesystem is wiped on each deploy, so uploads would vanish. The pinned deps include no Cloudinary SDK.
Fix: Cloudinary signed upload through `httpx` (no new dependency). The local fallback is for development only, and production must set `CROWN_CLOUDINARY_*` (E5 should fail the deploy check otherwise). Purging unreferenced media is out of scope.

### V21 (M). CSV export: needs all bookings, and it is open to formula injection
Evidence: `SettingsAdmin.tsx:17-33` builds the CSV from `crown.bookings`; the button shows the count (`:53`). `esc()` quotes cells but does not neutralize a leading `=`, `+`, `-`, `@`; `name` and `note` come from the public form.
Fix: admin state returns every booking (no window). Recommended one-line change in `esc()` to prefix `'` on those leading characters. It does not change what the page looks like; E4 decides whether that counts as within "verbatim".

### V22 (L). Demo copy becomes untrue or orphaned
Evidence: `SettingsAdmin.tsx:56` "Demo data lives in this browser only."; `:45` "Password changes and staff logins arrive with the live version."; `Login.tsx:120` "For this demo, use the account below."
Fix: kept verbatim under `DEMO_MODE=1` (fidelity). With `DEMO_MODE=0` the reset block and the demo box are hidden, but `Login.tsx:120` still refers to "the account below". Non-demo copy is **an open question** (there is no password-reset email in this plan).

### V23 (L). More hard-coded MagicPath links than the plan lists
Evidence: `kit.tsx:9` `SITE_URL` is used at `CrownShopAdmin.tsx:217,247`, `GalleryAdmin.tsx:122`, `Login.tsx:142`, `PricesAdmin.tsx:134`, `TeamAdmin.tsx:128` with `#/...` hash paths; the plan mentions only the footer admin link.
Fix: set `SITE_URL` to `''` and convert `#/x` to `/x` (callsites.md C).

### V24 (L). `shopStatus()` is dead code that reads static hours
Evidence: `data.ts:163-181` reads the constant `HOURS`, not admin-edited hours; it has no callers in either app (grep: only its definition).
Fix: do not port it (E5 cleanup list, next to `PHOTOS.pole`).

### V25 (M). The design sources have diverged from each other
Evidence: `web-ctx/src` and `web-edit/src` differ in 10 files (`Booking.tsx`, `Calendar.tsx`, `Footer.tsx`, `Gallery.tsx`, `Nav.tsx`, `Pages.tsx`, `Reviews.tsx`, `Services.tsx`, `Shop.tsx`, `Visit.tsx`); `web-edit` is newer (21:54 vs 21:47). I did not verify that `web-edit` equals the revision submitted to MagicPath.
Fix: E3/E4 port from E0's `design-snapshot/`, which is the revision the fidelity baseline uses. Re-run `gen_callsites.py` (see callsites.md) against the snapshot and diff the line numbers before porting.

### V26 (M). The scheduler duplicates work with more than one worker
Evidence: the plan says "single instance because of the scheduler", but a single Render instance still runs several processes if the start command uses `gunicorn -w 4`.
Fix: start with one uvicorn worker. The outbox takes rows with `FOR UPDATE SKIP LOCKED`, and `ux_sms_reminder_once` makes a duplicate reminder impossible even if two schedulers run.

### V27 (L). The public state list in the plan is incomplete
Evidence: the plan lists services, barbers, hours, closures, notice, gallery, bookings. `CrownState` also has `messages` (the type requires it). Hidden services are not addressed.
Fix: `messages` is filled with `[]` by the adapter; hidden services are omitted; closures only `>= today`; slot `status` normalized to `confirmed`; `sample` not emitted publicly (api-contract.md 3.1).

### V28 (L). `ymdPlus` uses +86 400 000 ms
Evidence: `store.ts:88-90`. On the night of the spring-forward change, between 23:00 and midnight, `ymdPlus(1)` can skip a date. The server uses calendar arithmetic.
Fix: accepted; the window edge can differ by one day for about an hour a year. The server stays authoritative.

### V29 (M). Diff-sync ordering under rapid edits
Evidence: closures toggle on every calendar tap (`HoursAdmin.tsx:252-267`); gallery reorder sends two PATCHes; undo follows the original within seconds. Parallel requests could arrive out of order (for example an undo PUT landing before the original PUT).
Fix: one FIFO queue across all slices, config PUTs coalesced, polls ignored while writes are pending (8.2).

### V30 (L). Admin and public validation differ on purpose
Evidence: the admin form validates hours on a 15-minute grid (`Bookings.tsx:207-221`), walk-ins are unvalidated (`Today.tsx:362-377`), and the site uses a 30-minute grid with a 20-minute lead.
Fix: server admin routes validate shape only, plus the unique index; public routes run the full list (api-contract.md 3.2, 4.3).

### V31 (L). E5's "one `Calendar.tsx`" merge risk
Evidence: `web-edit` and `admin-ctx` `Calendar.tsx` differ (both 271 lines). Merging them could shift pixels in either app.
Fix: merge only if both fidelity suites stay within 0.5%; otherwise keep two copies and note why.

### V32 (L). Two admin tabs: config PUT is last-write-wins
Fix: accepted for a one-owner shop. No ETags in v1.

### V33 (L). Upload type checking without Pillow
Fix: check magic bytes (`FF D8 FF`, `89 50 4E 47`, `RIFF....WEBP`) and cap at 5 MB. The browser already re-encodes to JPEG.

### V34 (L). E2's test list omits auth-adjacent behaviour this contract defines
Fix: add tests for the `X-Crown` CSRF header (403), a 429 on the sixth booking POST in a minute (with `TRUST_PROXY` both on and off), `demo/reset` returning 404 when `DEMO_MODE=0`, and the byte-identical round trip (V4).

### V35 (L). SMS consent
The design collects the phone number "Only used to confirm or reschedule." (`Booking.tsx:430`). Confirmation and reminder texts fit that purpose, but I have **not verified** Canadian (CASL) requirements. The user should confirm before real sending.

---

## Things checked that are fine

- **Admin screens that mutate several slices at once:** none. Every handler writes a single slice (callsites.md section A). The only multi-slice write is `resetDemo()`, which is one server call. Marking a day off does not touch bookings (the toast only counts them, `HoursAdmin.tsx:251,255-263`), and saving hours does not re-validate bookings.
- **Undo toasts:** 6 undo sites, all plain `setSlice` calls (api-contract.md 8.5), with server-side effects covered by V7 and V16.
- **`sample` flags:** set only by seeding and reset; public POSTs and new admin POSTs force `false`; restore keeps the stored value. "Remove N samples" is data-gated.
- **Plan layout/stack decisions:** consistent with Housing (router naming, `request: Request` first, SQL migrations, refresh rotation with reuse detection and grace).
