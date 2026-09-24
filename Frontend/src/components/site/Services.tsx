'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';
import { ArrowRight } from 'lucide-react';
import { cx, type ServiceCategory } from '@/lib/data';
import { useCrown, visibleServices } from '@/lib/store';
import { EASE, Heading, Logo, Ornament, Reveal } from '@/components/ui';
const TABS: {
  id: ServiceCategory;
  label: string;
}[] = [{
  id: 'cuts',
  label: 'Haircuts'
}, {
  id: 'shaves',
  label: 'Shaves & beards'
}];
export function Services({
  onPick,
  level = 'h2'
}: {
  onPick: (serviceId: string) => void;
  level?: 'h1' | 'h2';
}) {
  const [tab, setTab] = useState<ServiceCategory>('cuts');
  const reduce = useReducedMotion();
  const crown = useCrown();
  const items = visibleServices(crown).filter(s => s.category === tab);
  return <section id="services" className={cx('bg-surface px-5 pb-24 md:px-8 md:py-32', level === 'h1' ? 'pt-12' : 'pt-24')}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Heading level={level} className="text-balance max-w-[16ch] font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">
            The price board
          </Heading>
          <Ornament className="mt-5" />
          <p className="mt-4 max-w-[52ch] text-[19px] leading-relaxed text-ink-soft">
            What you see is what you pay. Pick a service to reserve it, or just walk in and ask for it.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          {/* enamel sign: outer chrome rim, inner navy board */}
          <div className="rounded-[1.5rem] bg-gradient-to-b from-chrome/70 to-chrome/30 p-2 ring-1 ring-line">
            <div className="relative overflow-hidden rounded-[calc(1.5rem-0.5rem)] bg-deep px-5 py-8 text-on-deep shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] md:px-12 md:py-12">
              <div className="flex flex-col gap-6 border-b border-on-deep/15 pb-6 md:flex-row md:items-end md:justify-between">
                <div className="flex items-center gap-3">
                  <Logo className="h-11 w-auto" />
                  <span className="font-sign text-xl font-semibold uppercase tracking-[0.08em] sm:text-2xl sm:tracking-[0.12em]">Crown Barber Shop</span>
                </div>
                <div role="tablist" aria-label="Service type" className="relative flex rounded-xl bg-white/5 p-1 ring-1 ring-white/15">
                  {TABS.map(t => <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cx('relative min-h-[48px] rounded-lg px-5 py-2 text-[17px] font-semibold transition-colors duration-200', tab === t.id ? 'text-deep' : 'text-on-deep/70 hover:text-on-deep')}>
                      {tab === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-lg bg-on-deep" transition={{
                    type: 'spring',
                    duration: 0.45,
                    bounce: 0.15
                  }} />}
                      <span className="relative">{t.label}</span>
                    </button>)}
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.ul key={tab} role="tabpanel" initial={reduce ? {
                opacity: 0
              } : {
                opacity: 0,
                y: 10,
                filter: 'blur(4px)'
              }} animate={{
                opacity: 1,
                y: 0,
                filter: 'blur(0px)'
              }} exit={{
                opacity: 0,
                transition: {
                  duration: 0.12
                }
              }} transition={{
                duration: 0.35,
                ease: EASE
              }} className="grid grid-cols-1 gap-x-14 md:grid-cols-2">
                  {items.map(s => <li key={s.id}>
                      <button type="button" onClick={() => onPick(s.id)} className="group -mx-3 flex w-[calc(100%+1.5rem)] flex-col rounded-2xl px-3 py-5 text-left transition-colors duration-200 hover:bg-white/[0.06]" aria-label={`Reserve ${s.name}, $${s.price}`}>
                        <span className="flex items-baseline gap-3">
                          <span className="font-display text-2xl font-medium md:text-[28px]">{s.name}</span>
                          <span className="leader" aria-hidden="true" />
                          <span className="font-sign text-3xl font-semibold tabular-nums">${s.price}</span>
                        </span>
                        <span className="mt-1.5 flex flex-col gap-3 text-[17px] text-on-deep/75 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                          <span>
                            <span className="block">{s.detail}</span>
                            <span className="block text-on-deep/60">About {s.minutes} minutes</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 font-semibold text-on-deep underline decoration-on-deep/40 underline-offset-4 group-hover:decoration-on-deep">
                            Reserve <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                          </span>
                        </span>
                      </button>
                    </li>)}
                </motion.ul>
              </AnimatePresence>

              <p className="mt-6 border-t border-on-deep/15 pt-6 font-sign text-[19px] uppercase tracking-[0.1em] text-on-deep/70">
                Cash only. No extra fees.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>;
}