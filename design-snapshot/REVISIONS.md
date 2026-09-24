# Design snapshot

Frozen copies of the MagicPath sources, fetched with `npx magicpath-ai code context <id>` on 2026-09-24.
These are the fidelity oracle's reference (`fidelity/`, target `magicpath`) and the source the
Frontend ports come from. Do not edit them; refetch and bump this file when the design changes.

| Folder | Component | Preview | Component id | Revision id |
|---|---|---|---|---|
| `site/src` | Crown Barber Shop Website | https://api.magicpath.ai/v1/bold-shade-8845 | 453566884927918080 | 453805872343322624 |
| `admin/src` | Crown Shop Admin | https://api.magicpath.ai/v1/gladly-cliff-2542 | 453630235984928768 | 453805148658102272 |
| (not copied) | Crown Barber Shop Mobile, same code as the site | https://api.magicpath.ai/v1/swift-dusk-8862 | 453626418958598144 | 453805144153411584 |

Project id: 453566591486038016.

## What changed in these revisions (E5 font fix)

The only change against the previous revisions is the design fonts:

- `src/App.tsx` (all three components): a module-level `<link rel="stylesheet" id="crown-fonts">` for
  `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Libre+Franklin:wght@400;500;600&display=swap`.
- `src/index.css` is unchanged. The plan's fix was to put that URL on line 1. That edit was submitted
  (and "completed"), but MagicPath rewrites line 1 back to the Libre Franklin-only import. A second try
  that appended `@font-face` rules was also rewritten: Bodoni Moda was collapsed to a single
  400/normal face, with no italic and no weight range. That revision was superseded by the one above.

Verified in Chromium on all three previews with `fidelity/fonts-check.ts`: Bodoni Moda (normal + italic,
400 700) and Barlow Condensed (500, 600) FontFaces are `loaded`, and the first h1 measures the
same width as its text set in "Bodoni Moda" and a different width from the Didot/Georgia fallback.
