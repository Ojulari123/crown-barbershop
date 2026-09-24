'use client';

import { useState } from 'react';
import { ArrowUpRight, PenLine, Quote, Star } from 'lucide-react';
import { REVIEWS, SHOP, cx, type Review } from '@/lib/data';
import { Heading, Ornament, Reveal } from '@/components/ui';

// Real reviews (Birdeye, BestProsInTown). The 4.8 / 127 summary is real; per-review stars
// were not published, so cards carry no star rows.

const GOOGLE_REVIEW_URL = 'https://www.google.com/maps/search/?api=1&query=Crown+Barber+Shop+219+Silvercreek+Pkwy+N+Guelph';
const AVATAR = ['#4f6bd8', '#c2410c', '#15803d', '#7e22ce', '#b91c1c', '#0e7490'];
function Stars({
  value,
  size = 'h-5 w-5'
}: {
  value: number;
  size?: string;
}) {
  const pct = Math.max(0, Math.min(100, value / 5 * 100));
  const row = (cls: string) => <span className={cx('flex gap-0.5', cls)}>
      {Array.from({
      length: 5
    }).map((_, i) => <Star key={i} className={size} fill="currentColor" strokeWidth={0} />)}
    </span>;
  return <span className="relative inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {row('text-[#dadce0] dark:text-white/20')}
      <span className="absolute inset-0 overflow-hidden" style={{
      width: `${pct}%`
    }}>
        {row('text-[#fbbc04]')}
      </span>
    </span>;
}
const initialOf = (r: Review) => r.name === 'Local reviewer' ? 'L' : r.name.replace(/[^A-Za-z]/g, '')[0] ?? 'C';
function ReviewCard({
  r,
  i
}: {
  r: Review;
  i: number;
}) {
  const [open, setOpen] = useState(false);
  const long = r.quote.length > 140;
  return <figure className="flex h-full flex-col rounded-2xl bg-white p-6 text-[#202124] shadow-[0_1px_2px_rgb(60_64_67/0.25),0_2px_8px_2px_rgb(60_64_67/0.08)] dark:bg-[#1f2330] dark:text-[#e8eaed]">
      <figcaption className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-body text-[17px] font-semibold text-white" style={{
        background: AVATAR[i % AVATAR.length]
      }} aria-hidden="true">
          {initialOf(r)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[17px] font-semibold">{r.name}</span>
          <span className="block text-[14px] text-[#5f6368] dark:text-[#9aa0a6]">
            {r.when ? `${r.when} · ` : ''}via {r.source}
          </span>
        </span>
      </figcaption>
      <blockquote className={cx('mt-4 flex-1 text-[17px] leading-relaxed', !open && long && 'line-clamp-4')}>{r.quote}</blockquote>
      {long && <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="mt-2 min-h-[44px] self-start text-[16px] font-semibold text-[#1a73e8] hover:underline dark:text-[#8ab4f8]">
          {open ? 'Show less' : 'Read more'}
        </button>}
    </figure>;
}
export function Reviews({
  level = 'h2'
}: {
  level?: 'h1' | 'h2';
}) {
  const featured = REVIEWS[0];
  const small = REVIEWS.slice(1).filter(r => !r.quote.startsWith('Feels like')).slice(0, 4);
  return <section id="reviews" className="relative overflow-hidden bg-surface-2 px-5 py-24 md:px-8 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        {/* header: title left, a slim Google-style rating line right */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <Heading level={level} className="text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">
              What the regulars say
            </Heading>
            <Ornament className="mt-5" />
          </Reveal>
          <Reveal delay={0.05} className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <span className="flex items-center gap-3">
              <span className="font-body text-[34px] font-semibold leading-none tabular-nums text-ink">{SHOP.rating}</span>
              <span>
                <Stars value={SHOP.rating} />
                <a href={SHOP.reviewSource} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[15px] font-medium text-ink-soft underline decoration-ink/25 underline-offset-4 hover:text-ink">
                  {SHOP.reviewCount} reviews <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              </span>
            </span>
            <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" className="press inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-[#1a73e8] shadow-[0_1px_2px_rgb(60_64_67/0.25)] ring-1 ring-inset ring-[#dadce0] hover:bg-[#f8f9fa]">
              <PenLine className="h-4 w-4" strokeWidth={2} /> Review us on Google
            </a>
          </Reveal>
        </div>

        {/* featured review + four more, as one balanced block */}
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          <Reveal className="md:col-span-2 lg:row-span-2">
            <figure className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-deep p-7 text-on-deep md:p-10">
              <div className="checker-sm pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rotate-12 opacity-[0.12] [mask-image:radial-gradient(closest-side,black,transparent)]" aria-hidden="true" />
              <Quote className="h-10 w-10 text-on-deep/35" strokeWidth={1.5} aria-hidden="true" />
              <blockquote className="relative mt-5 flex-1 font-display text-[25px] leading-[1.25] md:text-[36px]">{featured.quote}</blockquote>
              <figcaption className="relative mt-8 flex items-center gap-3 border-t border-white/15 pt-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full font-body text-[18px] font-semibold text-white" style={{
                background: AVATAR[0]
              }} aria-hidden="true">
                  {initialOf(featured)}
                </span>
                <span>
                  <span className="block text-[17px] font-semibold">{featured.name}</span>
                  <span className="block text-[15px] text-on-deep/70">
                    {featured.when ? `${featured.when} · ` : ''}via {featured.source}
                  </span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
          <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 md:contents" aria-label="More reviews">
            {small.map((r, i) => <Reveal key={r.quote} delay={0.04 * (i + 1)} className="w-[84%] shrink-0 snap-start md:w-auto">
                <ReviewCard r={r} i={i + 1} />
              </Reveal>)}
          </div>
        </div>
        <p className="mt-3 text-[15px] text-ink-soft md:hidden" aria-hidden="true">Swipe for more reviews</p>
      </div>
    </section>;
}