# Fidelity oracle

Pixel comparison of the MagicPath design (the reference) against the Next.js build. It captures 59
PNGs per target (site: every page and state at 390 and 1280 px, plus the home page at 768 and 1440;
admin: login and every view after the demo login) and diffs them with pixelmatch.

| File | What it does |
|---|---|
| `capture.ts` | `--target magicpath\|local --out <dir>` captures every shot (`--only <regex>`, `--concurrency <n>`). |
| `compare.ts` | `<dirA> <dirB> --out <dir> [--max 0.5]` prints the % of differing pixels per image and writes red overlays plus `report.{json,md}`. Exits 1 when an image is above `--max`. |
| `fonts-check.ts` | Proves Bodoni Moda and Barlow Condensed really render (FontFaces loaded, and the h1 width matches Bodoni and not the Didot fallback). |
| `baseline/` | The MagicPath capture used as the reference (revisions in `../design-snapshot/REVISIONS.md`). |

## Setup

```bash
cd fidelity
npm ci
npx playwright install chromium
```

## Run against the local stack

The design seeds its sample data from `Date.now()`; the browser clock is frozen at
**2026-09-25T10:15:00-04:00** (a Friday, 10:15 AM in Toronto). The backend must use the same instant,
or the demo bookings, "today" and slot availability will not line up:

```bash
# 1. API on the frozen clock (DEMO_MODE=1 is needed for the demo reset the capture calls)
cd Backend
CROWN_CLOCK_OVERRIDE=2026-09-25T10:15:00-04:00 .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
.venv/bin/python seed.py --demo --now 2026-09-25T10:15:00-04:00

# 2. Frontend production build in demo mode on :3000
cd Frontend
NEXT_PUBLIC_DEMO_MODE=1 npm run build && NEXT_PUBLIC_DEMO_MODE=1 npm run start

# 3. capture and compare
cd fidelity
npx tsx capture.ts --target local --out shots/local
npx tsx compare.ts baseline shots/local --out diff/local --max 0.5
```

Afterwards restart the API without `CROWN_CLOCK_OVERRIDE` and run `seed.py --demo` again, so the demo
data follows the real date.

To re-check the reference is deterministic: `npx tsx capture.ts --target magicpath --out shots/mp`,
then `npx tsx compare.ts baseline shots/mp --max 0`. To refresh the baseline after a design change,
capture into `baseline/` and update `../design-snapshot/`.

## How the capture is kept deterministic

- **Clock**: `page.clock.setFixedTime(FROZEN_TIME)` before the first navigation, in every context.
- **Motion**: `reducedMotion: 'reduce'`, screenshots with `animations: 'disabled'`, then a wait until no
  finite Web Animation is running, then screenshots repeated until two frames are byte-identical.
- **Randomness**: `Math.random` is replaced with a seeded generator (the design's `uid()` uses it).
- **Environment**: Chromium, device scale factor 1, `en-CA`, `America/Toronto`, light scheme.
- **Fonts**: each shot waits until the Bodoni Moda `@font-face` exists, then loads the design faces.
  Both targets load the fonts themselves (MagicPath through the `<link id="crown-fonts">` in `App.tsx`,
  Next through `next/font`); nothing is injected.
- **Body-scroll quirk**: the MagicPath preview sizes `html, body, #root` to 100% and scrolls `<body>`, so
  a full-page screenshot would only see one viewport. The capture CSS sets those three to
  `height:auto; min-height:0; overflow:visible` on **both** targets, so the document scrolls. On the Next
  build this changes nothing.
- **Masking**: the only nondeterministic region is the Google Maps embed. Its request is answered with an
  empty page and every `iframe` is `visibility:hidden`, identically on both targets. Nothing else is masked.
- **MagicPath banner**: closed via its "Close banner" button.
- **Admin session**: one sign-in per run in a throwaway context, reused through Playwright `storageState`
  (cookies on local; localStorage on MagicPath, where "Keep me signed in" is on by default). One run makes
  one login request, so the API's 10/minute login limit stays as it is.
- **Server writes (local only)**: the capture resets the demo data (`POST /api/admin/demo/reset`) before the
  run, before each booking "done" shot (the only shots that write) and after the run. Those shots run one at
  a time after the read-only shots, so nothing else sees the booking they create.

## Latest result (2026-09-24)

- MagicPath determinism: two consecutive captures, **59/59 byte-identical (0.00%)**.
- Local against the baseline: **worst 0.06%** (the admin Bookings views at 390); 26 of 59 images have 0 differing pixels at the default threshold (24 are byte-identical).
- Residuals: the differing regions are small: mostly icon-sized (about 15 px), the largest being the admin
  mobile tab bar at 390 (up to 47 px tall) and the menu-open backdrop. The ones inspected on 4x crops (the admin sidebar and tab-bar calendar icons, the "Directions" arrow on the home
  page at 390, the menu-open backdrop) look the same to the eye: sub-pixel anti-aliasing on lucide SVG icons,
  with identical size and position. The most likely cause is a different lucide build than the one bundled in
  the MagicPath preview (same icon names and classes in the port). The other small regions were not
  inspected one by one.
