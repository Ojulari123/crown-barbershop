// Compare two capture folders image by image.
//
//   npx tsx compare.ts baseline shots/local --out diff/
//
// Options:
//   --out <dir>          where overlay PNGs and report.{json,md} go (default diff/)
//   --threshold <0..1>   pixelmatch colour threshold (default 0.1)
//   --max <percent>      exit 1 if any image differs by more than this (e.g. 0.5)
//
// For each PNG present in either folder it prints the % of differing pixels. If the two
// images have different sizes, both are padded to the larger size and the padding counts
// as different (so a page that got taller or shorter shows up as a diff, not a crash).
// The overlay is pixelmatch's output: the "a" image faded, with differing pixels in red.
// `exact` is the count of pixels whose RGBA bytes are not identical (no threshold at all).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const argv = process.argv.slice(2);
const opt = (k: string) => {
  const i = argv.indexOf(`--${k}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const out = resolve(opt('out') ?? 'diff');
const threshold = Number(opt('threshold') ?? 0.1);
const maxRaw = opt('max');
const max = maxRaw === undefined ? null : Number(maxRaw);
const [a, b] = argv.map((p) => resolve(p));
if (!a || !b) {
  console.error('usage: compare.ts <dirA> <dirB> [--out diff/] [--threshold 0.1] [--max 0.5]');
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const pngs = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.png')) : []);
const names = [...new Set([...pngs(a), ...pngs(b)])].sort();

function pad(img: PNG, w: number, h: number) {
  if (img.width === w && img.height === h) return img;
  const p = new PNG({ width: w, height: h });
  // padding is opaque magenta so it can never match real content
  for (let i = 0; i < p.data.length; i += 4) p.data.set([255, 0, 255, 255], i);
  PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0);
  return p;
}

type Row = { name: string; status: 'ok' | 'missing-a' | 'missing-b'; sizeA?: string; sizeB?: string; diffPixels?: number; exact?: number; percent?: number };
const rows: Row[] = [];

for (const name of names) {
  const pa = join(a, name);
  const pb = join(b, name);
  if (!existsSync(pa) || !existsSync(pb)) {
    rows.push({ name, status: existsSync(pa) ? 'missing-b' : 'missing-a' });
    continue;
  }
  const ia = PNG.sync.read(readFileSync(pa));
  const ib = PNG.sync.read(readFileSync(pb));
  const w = Math.max(ia.width, ib.width);
  const h = Math.max(ia.height, ib.height);
  const A = pad(ia, w, h);
  const B = pad(ib, w, h);
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(A.data, B.data, diff.data, w, h, { threshold, alpha: 0.2, includeAA: false });
  let exact = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) exact++;
  }
  if (n > 0 || exact > 0) writeFileSync(join(out, name), PNG.sync.write(diff));
  rows.push({ name, status: 'ok', sizeA: `${ia.width}x${ia.height}`, sizeB: `${ib.width}x${ib.height}`, diffPixels: n, exact, percent: (n / (w * h)) * 100 });
}

const fmt = (r: Row) =>
  r.status !== 'ok'
    ? `${r.name.padEnd(40)} ${r.status}`
    : `${r.name.padEnd(40)} ${r.percent!.toFixed(2).padStart(6)}%  diff=${r.diffPixels}  exact=${r.exact}  ${r.sizeA}${r.sizeA === r.sizeB ? '' : ` vs ${r.sizeB}`}`;
rows.forEach((r) => console.log(fmt(r)));

const failing = rows.filter((r) => r.status !== 'ok' || (max !== null && r.percent! > max));
const worst = Math.max(0, ...rows.filter((r) => r.status === 'ok').map((r) => r.percent!));
const summary = { a, b, threshold, max, images: rows.length, missing: rows.filter((r) => r.status !== 'ok').length, worstPercent: worst, allZero: rows.every((r) => r.status === 'ok' && r.diffPixels === 0), allExact: rows.every((r) => r.status === 'ok' && r.exact === 0) };
writeFileSync(join(out, 'report.json'), JSON.stringify({ summary, rows }, null, 2));
writeFileSync(
  join(out, 'report.md'),
  [
    `# Fidelity diff`,
    ``,
    `- a: \`${a}\``,
    `- b: \`${b}\``,
    `- threshold ${threshold}; images ${rows.length}; missing ${summary.missing}; worst ${worst.toFixed(2)}%`,
    ``,
    `| image | % diff | diff px | exact px | size |`,
    `|---|---:|---:|---:|---|`,
    ...rows.map((r) =>
      r.status !== 'ok' ? `| ${r.name} | ${r.status} | | | |` : `| ${r.name} | ${r.percent!.toFixed(2)} | ${r.diffPixels} | ${r.exact} | ${r.sizeA}${r.sizeA === r.sizeB ? '' : ` vs ${r.sizeB}`} |`,
    ),
    ``,
  ].join('\n'),
);
console.log(`\n${rows.length} images, ${summary.missing} missing, worst ${worst.toFixed(2)}%, all zero: ${summary.allZero}, all byte-identical: ${summary.allExact} -> ${out}`);
process.exit(failing.length && (max !== null || summary.missing) ? 1 : 0);
