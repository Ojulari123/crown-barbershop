// Fidelity oracle: capture every design state as a PNG.
//
//   npx tsx capture.ts --target magicpath --out shots/mp-1
//   npx tsx capture.ts --target local --out shots/local
//
// Options:
//   --only <regex>         only shots whose file name matches
//   --concurrency <n>      parallel browser contexts (default 3)
//   --site-url / --admin-url   override a target's base URL
//   --api-url <url>        local only: API used for the demo reset (default http://127.0.0.1:3000/api)
//
// Every shot runs in a fresh browser context with the clock frozen before the first navigation,
// so the demo data the design seeds from Date.now() is identical. Admin shots sign in once per
// run (one extra context) and reuse that session through Playwright storageState, so a run makes
// a single login request (the local API rate-limits logins at 10/minute).
// On `local`, the demo data is reset through the API before the run and before each shot that
// writes (the booking "done" step), and those shots run one at a time after the others.
// States are driven by role/text selectors only, so the same table works on both targets.

import { chromium, type Browser, type BrowserContextOptions, type Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------- settings

const FROZEN_TIME = '2026-09-25T10:15:00-04:00'; // Friday, 10:15 AM in Toronto
const VIEWPORTS = {
  390: { width: 390, height: 844 },
  768: { width: 768, height: 1024 },
  1280: { width: 1280, height: 800 },
  1440: { width: 1440, height: 900 },
} as const;
type Vp = keyof typeof VIEWPORTS;

// Faces every shot waits for. Both targets load them themselves: MagicPath through the
// <link id="crown-fonts"> in App.tsx, the Next build through next/font.
const FONT_FACES = ['400 16px "Bodoni Moda"', 'italic 400 16px "Bodoni Moda"', '600 16px "Bodoni Moda"', '500 16px "Barlow Condensed"', '600 16px "Barlow Condensed"', '400 16px "Libre Franklin"'];

// The MagicPath preview makes <body> the scroll container (html/body/#root are height:100%,
// body overflow:auto), so a full-page screenshot would only see one viewport. This makes the
// document itself scroll, which is also how the Next.js build behaves. On `local` it is a no-op.
// The map iframe is third-party and nondeterministic, so it is hidden on every target.
const CAPTURE_CSS = `
html, body, #root { height: auto !important; min-height: 0 !important; overflow: visible !important; }
iframe { visibility: hidden !important; }
`;

type App = 'site' | 'admin';
type Target = 'magicpath' | 'local';

const TARGETS: Record<Target, { site: string; admin: string; url: (app: App, base: string, route: string) => string; login: (base: string) => string; loggedIn: RegExp | null }> = {
  magicpath: {
    site: 'https://api.magicpath.ai/v1/bold-shade-8845',
    admin: 'https://api.magicpath.ai/v1/gladly-cliff-2542',
    // hash routes: #/prices, #/today
    url: (_app, base, route) => `${base}#${route}`,
    login: (base) => base,
    loggedIn: null, // signs in in place (no URL change)
  },
  local: {
    site: 'http://127.0.0.1:3000',
    admin: 'http://127.0.0.1:3000/admin',
    // real paths: /prices, /admin/today
    url: (app, base, route) => (app === 'site' && route === '/' ? `${base}/` : `${base}${route}`),
    login: (base) => `${base}/login`,
    loggedIn: /\/admin\/today$/,
  },
};

const DEMO_LOGIN = { email: 'owner@crownbarbershop.ca', password: 'crown2026' };
const BOOKING = { service: /Skin fade/, barber: /Tania/, day: /^Friday, September 25/, name: 'Test Client', phone: '5195550100' };

// ---------------------------------------------------------------- state drivers

async function settle(page: Page, ms = 1000) {
  await page.waitForTimeout(ms);
}

async function bookTo(page: Page, step: 'service' | 'barber' | 'day' | 'time' | 'details' | 'done') {
  const main = page.getByRole('main');
  await main.getByRole('heading', { name: 'What are we doing today?' }).waitFor();
  if (step === 'service') return;
  await main.getByRole('button', { name: BOOKING.service }).first().click();
  await main.getByRole('heading', { name: 'Who would you like?' }).waitFor();
  if (step === 'barber') return;
  await main.getByRole('button', { name: BOOKING.barber }).first().click();
  await main.getByRole('heading', { name: 'Which day suits you?' }).waitFor();
  if (step === 'day') return;
  await main.getByRole('button', { name: BOOKING.day }).click();
  await main.getByRole('heading', { name: 'Pick a time' }).waitFor();
  if (step === 'time') return;
  await main.getByRole('radiogroup', { name: 'Time' }).getByRole('radio').first().click();
  await main.getByRole('heading', { name: 'Last thing, who is coming in?' }).waitFor();
  await main.getByLabel('Your name').fill(BOOKING.name);
  await main.getByLabel('Phone number').fill(BOOKING.phone);
  if (step === 'details') return;
  await main.getByRole('button', { name: 'Request this time' }).click();
  await main.getByRole('button', { name: 'Request this time' }).waitFor({ state: 'detached', timeout: 10_000 });
  await settle(page, 800);
}

// Sign in once in a throwaway context and return its storageState (cookies on local,
// localStorage on MagicPath: the design keeps "Keep me signed in" on by default).
async function adminSession(browser: Browser, cfg: ReturnType<typeof args>) {
  const t = TARGETS[cfg.target];
  const ctx = await newShotContext(browser, cfg, 1280);
  try {
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(FROZEN_TIME));
    await page.goto(t.login(cfg.adminUrl), { waitUntil: 'load' });
    await closeBanner(page);
    await page.getByLabel('Email').fill(DEMO_LOGIN.email);
    await page.getByLabel('Password', { exact: true }).fill(DEMO_LOGIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // local sign-in is a real request: wait for the redirect it triggers, not just the button
    if (t.loggedIn) await page.waitForURL(t.loggedIn, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Sign in' }).waitFor({ state: 'detached', timeout: 15_000 });
    await page.locator('[data-admin-title]').first().waitFor({ timeout: 15_000 });
    return await ctx.storageState();
  } finally {
    await ctx.close();
  }
}

// local only: put the demo data back to the design's samples (server clock = frozen clock).
// The endpoint is limited to 5/minute, so a 429 waits and retries.
async function resetDemo(browser: Browser, cfg: ReturnType<typeof args>, state: Awaited<ReturnType<typeof adminSession>>) {
  const ctx = await browser.newContext({ storageState: state });
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await ctx.request.post(`${cfg.apiUrl}/admin/demo/reset`, { headers: { 'X-Crown': '1' } });
      if (r.ok()) return;
      if (r.status() !== 429) throw new Error(`demo reset failed: HTTP ${r.status()} ${await r.text()}`);
      console.log('demo reset rate-limited, waiting 20 s');
      await new Promise((res) => setTimeout(res, 20_000));
    }
    throw new Error('demo reset kept returning 429');
  } finally {
    await ctx.close();
  }
}

async function adminTab(page: Page, name: RegExp) {
  await page.getByRole('tablist', { name: 'Booking lists' }).getByRole('tab', { name }).click();
}

// ---------------------------------------------------------------- the shot table

interface Shot {
  name: string;
  app: App;
  route: string; // app route: '/prices' (site), '/today' (admin)
  viewports: Vp[];
  full?: boolean; // full page (default) or viewport only (overlays)
  auth?: boolean; // admin: log in with the demo account first
  writes?: boolean; // changes server data on `local` (reset before it, run serially)
  ready?: (page: Page) => Promise<void>; // wait for the page to be itself
  act?: (page: Page, vp: Vp) => Promise<void>; // drive the state
}

const BOTH: Vp[] = [390, 1280];
const h1 = (page: Page) => page.getByRole('main').getByRole('heading', { level: 1 }).first().waitFor();

const SHOTS: Shot[] = [
  // site pages
  { name: 'site-home', app: 'site', route: '/', viewports: [390, 768, 1280, 1440], ready: h1 },
  { name: 'site-prices', app: 'site', route: '/prices', viewports: BOTH, ready: h1 },
  { name: 'site-book', app: 'site', route: '/book', viewports: BOTH, ready: h1 },
  { name: 'site-gallery', app: 'site', route: '/gallery', viewports: BOTH, ready: h1 },
  { name: 'site-about', app: 'site', route: '/about', viewports: BOTH, ready: h1 },
  { name: 'site-visit', app: 'site', route: '/visit', viewports: BOTH, ready: h1 },
  { name: 'site-404', app: 'site', route: '/this-page-does-not-exist', viewports: BOTH, ready: h1 },
  // site states
  {
    // the menu button is lg:hidden, so this state only exists below 1024px
    name: 'site-menu-open', app: 'site', route: '/', viewports: [390], full: false, ready: h1,
    act: async (page) => {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.getByRole('button', { name: 'Close', exact: true }).waitFor();
      await settle(page, 1200);
    },
  },
  {
    name: 'site-lightbox', app: 'site', route: '/gallery', viewports: BOTH, full: false, ready: h1,
    act: async (page) => {
      await page.getByRole('main').getByRole('button', { name: /^Open photo/ }).first().click();
      await page.getByRole('dialog', { name: 'Photo viewer' }).waitFor();
    },
  },
  {
    name: 'site-prices-shaves', app: 'site', route: '/prices', viewports: BOTH, ready: h1,
    act: async (page) => {
      await page.getByRole('tab', { name: 'Shaves & beards' }).click();
      await page.getByRole('tab', { name: 'Shaves & beards', selected: true }).waitFor();
    },
  },
  {
    name: 'site-visit-faq2', app: 'site', route: '/visit', viewports: BOTH, ready: h1,
    act: async (page) => {
      await page.getByRole('button', { name: 'How do I pay?' }).click();
      await page.getByRole('button', { name: 'How do I pay?', expanded: true }).waitFor();
    },
  },
  ...(['service', 'barber', 'day', 'time', 'details', 'done'] as const).map(
    (step, i): Shot => ({
      name: `site-book-${i + 1}-${step}`, app: 'site', route: '/book', viewports: BOTH, ready: h1, writes: step === 'done',
      act: (page) => bookTo(page, step),
    }),
  ),

  // admin
  { name: 'admin-login', app: 'admin', route: '', viewports: BOTH, ready: (p) => p.getByRole('heading', { name: 'Sign in to the admin' }).waitFor() },
  ...(['today', 'bookings', 'messages', 'gallery', 'team', 'prices', 'hours', 'settings'] as const).map(
    (v): Shot => ({ name: `admin-${v}`, app: 'admin', route: `/${v}`, viewports: BOTH, auth: true }),
  ),
  {
    name: 'admin-bookings-upcoming', app: 'admin', route: '/bookings', viewports: BOTH, auth: true,
    act: (page) => adminTab(page, /^Upcoming/),
  },
  {
    name: 'admin-bookings-past', app: 'admin', route: '/bookings', viewports: BOTH, auth: true,
    act: (page) => adminTab(page, /^Past/),
  },
  {
    // "To confirm" is the default tab (admin-bookings); open the first row's drawer
    name: 'admin-bookings-drawer', app: 'admin', route: '/bookings', viewports: BOTH, auth: true, full: false,
    act: async (page) => {
      await page.getByRole('tablist', { name: 'Booking lists' }).getByRole('tab', { name: /^To confirm/ }).click();
      await page.locator('table tbody tr').filter({ has: page.getByRole('button') }).first().getByRole('button').first().click();
      await page.getByRole('dialog').first().waitFor();
    },
  },
];

// ---------------------------------------------------------------- runner

function args() {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const target = (get('target') ?? 'magicpath') as Target;
  if (!(target in TARGETS)) throw new Error(`--target must be magicpath or local`);
  const out = get('out');
  if (!out) throw new Error('--out <dir> is required');
  return {
    target,
    out: resolve(out),
    only: get('only') ? new RegExp(get('only')!) : null,
    concurrency: Number(get('concurrency') ?? 3),
    siteUrl: get('site-url') ?? TARGETS[target].site,
    adminUrl: get('admin-url') ?? TARGETS[target].admin,
    apiUrl: get('api-url') ?? 'http://127.0.0.1:3000/api',
  };
}

async function closeBanner(page: Page) {
  const btn = page.getByRole('button', { name: 'Close banner' });
  if (await btn.count()) {
    await btn.first().click();
    await btn.first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}

// Fonts, images and transitions done; lazy images forced to load.
async function waitForStill(page: Page) {
  // the design fonts' @font-face rules must exist before they can be loaded
  await page
    .waitForFunction(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Bodoni Moda'), undefined, { timeout: 15_000 })
    .catch(() => console.log(`  warn: no Bodoni Moda @font-face on ${page.url()}`));
  await page.evaluate(async (faces) => {
    await Promise.all(faces.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    for (const img of Array.from(document.images)) if (img.loading === 'lazy') img.loading = 'eager';
    const pending = Array.from(document.images).filter((i) => !i.complete);
    await Promise.race([
      Promise.all(pending.map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
      new Promise((r) => setTimeout(r, 15000)),
    ]);
    await Promise.all(Array.from(document.images).map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    await document.fonts.ready;
  }, FONT_FACES);
  await page.mouse.move(1, 1); // no hover state left on the last clicked control
  // clicks scroll controls into view; start every shot from the top so sticky bars sit at y=0
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await settle(page, 1000);
  // Framer Motion runs opacity through the Web Animations API. With the frozen clock some of
  // those take over a second to finish, and a screenshot taken mid-flight is a coin toss.
  // Wait until no finite animation is still running.
  await page
    .waitForFunction(
      () => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().endTime === Infinity),
      undefined,
      { timeout: 10_000, polling: 100 },
    )
    .catch(() => {});
  await settle(page, 300);
}

// Screenshot until two consecutive frames are byte-identical (catches JS-driven motion
// that getAnimations() cannot see). Returns the stable frame.
async function stableShot(page: Page, fullPage: boolean) {
  const opts = { fullPage, animations: 'disabled' as const, caret: 'hide' as const, scale: 'css' as const };
  let prev = await page.screenshot(opts);
  for (let i = 0; i < 6; i++) {
    await settle(page, 400);
    const cur = await page.screenshot(opts);
    if (cur.equals(prev)) return { buf: cur, stable: true };
    prev = cur;
  }
  return { buf: prev, stable: false };
}

type Session = Awaited<ReturnType<typeof adminSession>>;

// Same settings for every context: viewport, reduced motion, locale, time zone, the capture CSS,
// a seeded Math.random and a stubbed map embed.
async function newShotContext(browser: Browser, _cfg: ReturnType<typeof args>, vp: Vp, storageState?: BrowserContextOptions['storageState']) {
  const ctx = await browser.newContext({
    viewport: VIEWPORTS[vp],
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
    storageState,
  });
  // tsx/esbuild adds __name() around named functions; give page.evaluate a no-op.
  await ctx.addInitScript('window.__name = (f) => f;');
  // Deterministic Math.random (the design's uid() uses it).
  await ctx.addInitScript(() => {
    let s = 0x2f6e2b1;
    Math.random = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  });
  await ctx.addInitScript((css) => {
    const add = () => {
      if (document.getElementById('fidelity-css')) return;
      const style = document.createElement('style');
      style.id = 'fidelity-css';
      style.textContent = css;
      document.head.appendChild(style);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add);
  }, CAPTURE_CSS);
  // Google Maps embed: answer with an empty page so onLoad fires the same way every run.
  await ctx.route(/^https:\/\/(maps|www)\.google\.com\/maps.*output=embed/, (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>map</title>' }),
  );
  return ctx;
}

async function runShot(browser: Browser, cfg: ReturnType<typeof args>, shot: Shot, vp: Vp, session: Session | null) {
  const file = `${shot.name}@${vp}.png`;
  const t = TARGETS[cfg.target];
  const base = shot.app === 'site' ? cfg.siteUrl : cfg.adminUrl;
  const ctx = await newShotContext(browser, cfg, vp, shot.auth && session ? session : undefined);
  try {
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(FROZEN_TIME));
    await page.goto(t.url(shot.app, base, shot.route), { waitUntil: 'load' });
    if (shot.auth && cfg.target === 'magicpath') {
      // same-document hash change: make sure the view switched
      await page.waitForFunction((r) => window.location.hash === `#${r}`, shot.route);
    }
    await closeBanner(page);
    if (shot.ready) await shot.ready(page);
    else if (shot.app === 'admin') await page.locator('[data-admin-title], h1').first().waitFor();
    await waitForStill(page);
    if (shot.act) {
      await shot.act(page, vp);
      await waitForStill(page);
    }
    const { buf, stable } = await stableShot(page, shot.full !== false);
    writeFileSync(join(cfg.out, file), buf);
    return { file, ok: true as const, stable };
  } catch (e) {
    return { file, ok: false as const, error: String((e as Error).message ?? e).split('\n')[0] };
  } finally {
    await ctx.close();
  }
}

async function main() {
  const cfg = args();
  mkdirSync(cfg.out, { recursive: true });
  const jobs = SHOTS.flatMap((s) => s.viewports.map((vp) => ({ s, vp }))).filter(({ s, vp }) => !cfg.only || cfg.only.test(`${s.name}@${vp}`));
  const browser = await chromium.launch();
  const local = cfg.target === 'local';
  const needsSession = jobs.some(({ s }) => s.auth) || (local && jobs.some(({ s }) => s.writes));
  const session = needsSession ? await adminSession(browser, cfg) : null;
  if (local && session) await resetDemo(browser, cfg, session);
  const results: Awaited<ReturnType<typeof runShot>>[] = [];
  const log = (r: (typeof results)[number]) =>
    console.log(r.ok ? `ok   ${r.file}${r.stable ? '' : '  (UNSTABLE: frames kept changing)'}` : `FAIL ${r.file}: ${r.error}`);
  // read-only shots in parallel, then (local) each writing shot alone on fresh demo data
  const parallel = local ? jobs.filter(({ s }) => !s.writes) : jobs;
  const serial = local ? jobs.filter(({ s }) => s.writes) : [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, cfg.concurrency) }, async () => {
      while (next < parallel.length) {
        const { s, vp } = parallel[next++];
        const r = await runShot(browser, cfg, s, vp, session);
        results.push(r);
        log(r);
      }
    }),
  );
  for (const { s, vp } of serial) {
    await resetDemo(browser, cfg, session!);
    const r = await runShot(browser, cfg, s, vp, session);
    results.push(r);
    log(r);
  }
  if (serial.length) await resetDemo(browser, cfg, session!);
  await browser.close();
  results.sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(
    join(cfg.out, 'capture.json'),
    JSON.stringify({ target: cfg.target, siteUrl: cfg.siteUrl, adminUrl: cfg.adminUrl, frozenTime: FROZEN_TIME, capturedAt: new Date().toISOString(), results }, null, 2),
  );
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} captured -> ${cfg.out}`);
  process.exit(failed.length ? 1 : 0);
}

main();
