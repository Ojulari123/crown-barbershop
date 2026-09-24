'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';
import { Phone } from 'lucide-react';
import { PHOTOS, SHOP } from '@/lib/data';
import { EASE, Ornament, Pill } from '@/components/ui';
export function Hero() {
  const reduce = useReducedMotion();
  const rise = (d: number) => ({
    initial: reduce ? {
      opacity: 0
    } : {
      opacity: 0,
      y: 24
    },
    animate: {
      opacity: 1,
      y: 0
    },
    transition: {
      duration: 0.8,
      delay: d,
      ease: EASE
    }
  });
  return <section id="top" className="relative -mt-[76px] overflow-hidden md:-mt-20">
      {/* powder-blue wall */}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-2 via-surface-2 to-surface" aria-hidden="true" />

      {/* The signature: the shop's checkerboard floor, receding in perspective */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] [perspective:700px] md:h-[30%]" aria-hidden="true">
        <div className="checker floor-roll absolute -left-1/2 top-0 h-[260%] w-[200%] origin-top [transform:rotateX(64deg)] [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_45%,transparent_75%)]" />
      </div>

      <div className="relative mx-auto grid min-h-[min(100dvh,980px)] max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-[10vh] pt-32 md:grid-cols-12 md:gap-8 md:px-8 md:pb-[30vh] md:pt-28">
        <div className="md:col-span-7">

          <motion.h1 {...rise(0.2)} tabIndex={-1} className="focus:outline-none pb-1 text-balance font-display text-[44px] font-medium leading-[1.02] tracking-[-0.02em] text-ink sm:text-6xl lg:text-[76px]">
            Old-school cuts on <span className="italic text-cobalt">Silvercreek.</span>
          </motion.h1>
          <motion.div {...rise(0.25)}>
            <Ornament className="mt-6" />
          </motion.div>

          <motion.p {...rise(0.3)} className="mt-6 max-w-[36ch] text-[20px] leading-relaxed text-ink-soft md:text-[21px]">
            Classic cuts, fades and hot towel shaves at Silvercreek and Speedvale. Walk-ins welcome, Tuesday to Saturday.
          </motion.p>

          <motion.div {...rise(0.4)} className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Pill href="/book" className="w-full sm:w-auto">Reserve a chair</Pill>
            <Pill href={SHOP.phoneHref} variant="ghost" className="w-full sm:w-auto" icon={<Phone className="h-5 w-5 text-cobalt" strokeWidth={1.75} />}>
              {SHOP.phoneDisplay}
            </Pill>
          </motion.div>
        </div>

        {/* Arched mirror, like the round mirrors in the shop */}
        <motion.div initial={reduce ? {
        opacity: 0
      } : {
        opacity: 0,
        y: 40,
        scale: 0.97
      }} animate={{
        opacity: 1,
        y: 0,
        scale: 1
      }} transition={{
        duration: 1.1,
        delay: 0.25,
        ease: EASE
      }} className="relative mx-auto w-full max-w-[320px] md:col-span-5 md:max-w-[380px] md:translate-y-[18vh]">
          <div className="rounded-t-[999px] rounded-b-[2rem] bg-gradient-to-b from-white to-chrome/60 p-2 shadow-[0_40px_80px_-30px_rgb(20_33_92/0.55)] ring-1 ring-line dark:from-surface-2 dark:to-deep">
            <div className="overflow-hidden rounded-t-[999px] rounded-b-[calc(1.5rem-0.5rem)] bg-surface-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
              <img src={PHOTOS.hero} width={1000} height={1250} alt="A vintage barber chair on a checkerboard floor" className="aspect-[4/5] h-full w-full object-cover" fetchPriority="high" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>;
}