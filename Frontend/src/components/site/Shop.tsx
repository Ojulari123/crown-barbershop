'use client';

import { Camera, DoorOpen } from 'lucide-react';
import { PHOTOS, cx } from '@/lib/data';
import { Heading, Ornament, Reveal } from '@/components/ui';
export function Shop({
  level = 'h2'
}: {
  level?: 'h1' | 'h2';
}) {
  return <section id="shop" className={cx('bg-surface px-5 pb-24 md:px-8 md:py-32', level === 'h1' ? 'pt-12' : 'pt-24')}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Heading level={level} className="text-balance max-w-[18ch] font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">
            An old-school shop, <span className="italic">kept that way.</span>
          </Heading>
          <Ornament className="mt-5" />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-[260px_260px]">
          {/* 1. big photo */}
          <Reveal className="overflow-hidden rounded-[1.25rem] md:col-span-4 md:row-span-2">
            <img src={PHOTOS.chair} width={1400} height={1000} alt="A classic barbershop interior in black and white" loading="lazy" className="h-72 w-full object-cover md:h-full" />
          </Reveal>

          {/* 2. Tania */}
          <Reveal delay={0.05} className="flex flex-col justify-between rounded-[1.25rem] bg-surface-2 p-7 md:col-span-2">
            <p className="font-sign text-[17px] font-semibold uppercase tracking-[0.12em] text-cobalt">Ask for Tania</p>
            <blockquote>
              <p className="font-display text-[26px] leading-[1.15] text-ink">&ldquo;Tania is fantastic!!! … does an incredible job.&rdquo;</p>
              <footer className="mt-3 text-[16px] text-ink-soft">Andrew C., Birdeye review</footer>
            </blockquote>
          </Reveal>

          {/* 3. walk-in, on the checker tile */}
          <Reveal delay={0.1} className="relative overflow-hidden rounded-[1.25rem] md:col-span-2">
            <div className="checker-sm absolute inset-0" aria-hidden="true" />
            <div className="relative flex h-full min-h-[240px] flex-col justify-end p-4">
              <div className="rounded-[1.25rem] bg-surface p-5 shadow-[0_12px_30px_-12px_rgb(20_33_92/0.5)]">
                <DoorOpen className="mb-3 h-6 w-6 text-cobalt" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="font-display text-2xl text-ink">Just walk in</h3>
                <p className="mt-1.5 text-[17px] leading-relaxed text-ink-soft">No app, no account, no deposit. Take a seat and wait your turn.</p>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-6">
          {/* 4. bring a photo */}
          <Reveal className="flex flex-col justify-between gap-10 rounded-[1.25rem] bg-cobalt p-7 text-on-cobalt md:col-span-3">
            <Camera className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h3 className="font-display text-3xl">Not sure what you want?</h3>
              <p className="mt-2 max-w-[40ch] text-[17px] leading-relaxed opacity-85">
                Bring a photo on your phone. It is the quickest way to get the cut you are picturing.
              </p>
            </div>
          </Reveal>

          {/* 5. photo */}
          <Reveal delay={0.05} className="overflow-hidden rounded-[1.25rem] md:col-span-3">
            <img src={PHOTOS.cut} width={900} height={700} alt="A barber lining up a client's haircut" loading="lazy" className="h-64 w-full object-cover md:h-full md:max-h-[300px]" />
          </Reveal>
        </div>
      </div>
    </section>;
}