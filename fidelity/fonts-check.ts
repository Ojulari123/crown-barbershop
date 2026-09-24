// Verifies the design fonts really render in a real browser on each URL.
//
//   npx tsx fonts-check.ts [url ...]
//
// document.fonts.check() returns true when NO @font-face matches the family at all (the spec
// treats "nothing to load" as available), so on its own it proves nothing. The pass criteria are:
//   1. FontFace objects for Bodoni Moda and Barlow Condensed with status "loaded", and
//   2. the first h1 (a font-display heading) measures the same width as its text set in
//      "Bodoni Moda" and a different width from the design's Didot/Georgia fallback.
import { chromium } from 'playwright';

const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'https://api.magicpath.ai/v1/bold-shade-8845',
      'https://api.magicpath.ai/v1/swift-dusk-8862',
      'https://api.magicpath.ai/v1/gladly-cliff-2542',
      'http://127.0.0.1:3000/',
      'http://127.0.0.1:3000/admin/login',
    ];

const browser = await chromium.launch();
let ok = true;
for (const url of urls) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript('window.__name = (f) => f;');
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('h1').first().waitFor();
  const r = await page.evaluate(async () => {
    const faces = ['16px "Bodoni Moda"', 'italic 16px "Bodoni Moda"', '600 16px "Bodoni Moda"', '500 16px "Barlow Condensed"', '600 16px "Barlow Condensed"'];
    await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null)));
    await document.fonts.ready;
    const check = {
      bodoni: document.fonts.check('32px "Bodoni Moda"'),
      barlow: document.fonts.check('32px "Barlow Condensed"'),
    };
    const loaded = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')} ${f.style} ${f.weight}`))];
    const h1 = document.querySelector('h1') as HTMLElement;
    const cs = getComputedStyle(h1);
    const measure = (family: string) => {
      const s = document.createElement('span');
      s.textContent = h1.textContent;
      Object.assign(s.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: family, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, letterSpacing: cs.letterSpacing, fontOpticalSizing: 'auto' });
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return Math.round(w * 10) / 10;
    };
    return {
      check,
      loaded,
      h1: { text: h1.textContent?.slice(0, 40), fontFamily: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight },
      width: { asRendered: measure(cs.fontFamily), bodoni: measure('"Bodoni Moda"'), didotFallback: measure('Didot, Georgia, serif') },
    };
  });
  const bodoniLoaded = r.loaded.some((l) => l.startsWith('Bodoni Moda'));
  const barlowLoaded = r.loaded.some((l) => l.startsWith('Barlow Condensed'));
  const h1IsBodoni = r.width.asRendered === r.width.bodoni && r.width.asRendered !== r.width.didotFallback;
  const pass = r.check.bodoni && r.check.barlow && bodoniLoaded && barlowLoaded && h1IsBodoni;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${url}\n${JSON.stringify(r, null, 1)}\n  bodoniLoaded=${bodoniLoaded} barlowLoaded=${barlowLoaded} h1IsBodoni=${h1IsBodoni}`);
  await ctx.close();
}
await browser.close();
console.log(ok ? 'FONTS OK' : 'FONTS MISSING');
process.exit(ok ? 0 : 1);
