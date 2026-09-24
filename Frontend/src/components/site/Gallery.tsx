'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';
import { ArrowLeft, ArrowRight, Images, X } from 'lucide-react';
import { cx } from '@/lib/data';
import { STYLE_LABELS, homepagePhotos, useCrown, type CutStyle, type Photo } from '@/lib/store';
import { EASE, Ornament, Pill, Reveal } from '@/components/ui';
function Print({
  photo,
  onOpen,
  className
}: {
  photo: Photo;
  onOpen: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return <motion.button type="button" onClick={onOpen} aria-label={`Open photo: ${photo.caption || STYLE_LABELS[photo.style]}`} className={cx('group block w-full bg-white p-2 shadow-[0_18px_40px_-18px_rgb(6_11_34/0.55)] ring-1 ring-black/5 md:p-2.5', className)} whileHover={reduce ? undefined : {
    y: -8,
    transition: {
      type: 'spring',
      duration: 0.35,
      bounce: 0
    }
  }} whileTap={{
    scale: 0.98
  }}>
      <span className="block overflow-hidden bg-surface-2">
        <img src={photo.src} alt="" loading="lazy" width={600} height={750} className="aspect-[4/5] h-auto w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.03]" />
      </span>
    </motion.button>;
}
export function GallerySection({
  onOpenPhoto
}: {
  onOpenPhoto: (id: string, list: string[]) => void;
}) {
  const crown = useCrown();
  const reduce = useReducedMotion();
  const picks = homepagePhotos(crown);
  if (picks.length === 0) return null; // the shop has not added any photos: hide the section entirely
  const ids = picks.map(x => x.id);

  // Feature photo + up to four smaller ones. Fewer photos fall back to an even row.
  const bento = picks.length >= 5;
  return <section id="cuts" className="slant-top overflow-hidden bg-deep px-5 pb-24 text-on-deep md:px-8 md:pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <h2 className="text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-6xl">Recent cuts</h2>
            <Ornament className="mt-5" tone="text-on-deep/70" />
            <p className="mt-4 max-w-[44ch] text-[19px] leading-relaxed text-on-deep/80">Fresh from the chair. Tap a photo to see it up close, or show it to your barber.</p>
          </Reveal>
          <Reveal delay={0.05}>
            <Pill variant="light" href="/gallery" className="w-full sm:w-auto" icon={<Images className="h-5 w-5" strokeWidth={1.75} />}>
              See all {crown.gallery.length} cuts
            </Pill>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-12">
          <ul className={cx('grid gap-3 md:gap-4', bento ? 'grid-cols-2 md:h-[600px] md:grid-cols-4 md:grid-rows-2' : ({
          1: 'grid-cols-1',
          2: 'grid-cols-2',
          3: 'grid-cols-2 md:grid-cols-3',
          4: 'grid-cols-2 md:grid-cols-4'
        } as Record<number, string>)[picks.length])}>
            {picks.slice(0, 5).map((p, i) => {
            const feature = bento && i === 0;
            return <li key={p.id} className={cx(feature && 'col-span-2 md:row-span-2', bento && !feature && 'md:col-span-1')}>
                  <motion.button type="button" onClick={() => onOpenPhoto(p.id, ids)} aria-label={`Open photo: ${p.caption || STYLE_LABELS[p.style]}`} whileTap={{
                scale: 0.985
              }} className={cx('group relative block h-full w-full overflow-hidden rounded-[1.25rem] bg-white/5 ring-1 ring-white/10', feature ? 'aspect-[4/3] md:aspect-auto' : 'aspect-square md:aspect-auto')}>
                    <img src={p.src} alt="" loading="lazy" className={cx('absolute inset-0 h-full w-full object-cover', !reduce && 'transition-transform duration-[900ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.05]')} />
                    {/* caption fades in on hover or keyboard focus only */}
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 items-end justify-between gap-3 bg-gradient-to-t from-[#060b22]/85 via-[#060b22]/30 to-transparent px-4 pb-4 pt-16 text-left opacity-0 transition-[opacity,translate] duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                      <span className={cx('font-display leading-tight text-white', feature ? 'text-[26px]' : 'text-[19px]')}>{p.caption || STYLE_LABELS[p.style]}</span>
                    </span>
                  </motion.button>
                </li>;
          })}
          </ul>
        </Reveal>
      </div>
    </section>;
}

// ---------------- gallery page ----------------

export function GalleryPage({
  onOpenPhoto
}: {
  onOpenPhoto: (id: string, list: string[]) => void;
}) {
  const crown = useCrown();
  const [filter, setFilter] = useState<CutStyle | 'all'>('all');
  const reduce = useReducedMotion();
  const photos = useMemo(() => [...crown.gallery].sort((a, b) => b.createdAt - a.createdAt), [crown.gallery]);
  const styles = useMemo(() => {
    const counts = new Map<CutStyle, number>();
    photos.forEach(p => counts.set(p.style, (counts.get(p.style) ?? 0) + 1));
    return [...counts.entries()];
  }, [photos]);
  const shown = filter === 'all' ? photos : photos.filter(p => p.style === filter);
  return <section className="bg-surface px-5 pb-24 md:px-8 md:pb-32">
      <div className="mx-auto max-w-6xl">
        {photos.length === 0 ? <div className="rounded-[1.25rem] bg-surface-2 p-8 text-center md:p-14">
            <Images className="mx-auto h-8 w-8 text-cobalt" strokeWidth={1.5} aria-hidden="true" />
            <p className="mt-4 font-display text-3xl text-ink">New photos are on the way.</p>
            <p className="mx-auto mt-2 max-w-[40ch] text-[18px] text-ink-soft">Come in for a cut and see the work in person, or call the shop to ask about a style.</p>
          </div> : <>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="radiogroup" aria-label="Filter by style">
              {[['all', photos.length] as const, ...styles].map(([id, n]) => {
            const active = filter === id;
            return <button key={id} type="button" role="radio" aria-checked={active} onClick={() => setFilter(id)} className={cx('press min-h-[48px] shrink-0 whitespace-nowrap rounded-[10px] px-4 text-[17px] font-semibold ring-1 ring-inset', active ? 'bg-deep text-on-deep ring-deep dark:bg-cobalt dark:text-on-cobalt' : 'bg-surface text-ink ring-ink/20 hover:bg-surface-2')}>
                    {id === 'all' ? 'All' : STYLE_LABELS[id]} <span className={cx('tabular-nums', active ? 'opacity-70' : 'text-ink-soft')}>{n}</span>
                  </button>;
          })}
            </div>

            <ul className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4">
              <AnimatePresence initial={false}>
                {shown.map(p => <motion.li key={p.id} layout={!reduce} initial={{
              opacity: 0
            }} animate={{
              opacity: 1
            }} exit={{
              opacity: 0
            }} transition={{
              duration: 0.25,
              ease: EASE
            }} className="mb-4 break-inside-avoid">
                    <Print photo={p} onOpen={() => onOpenPhoto(p.id, shown.map(x => x.id))} />
                  </motion.li>)}
              </AnimatePresence>
            </ul>
          </>}

        <div className="mt-14 flex flex-col items-start gap-4 rounded-[1.25rem] bg-surface-2 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <p className="font-display text-2xl text-ink md:text-3xl">See one you like? Show it to your barber.</p>
          <Pill href="/book" className="w-full sm:w-auto">
            Reserve a chair
          </Pill>
        </div>
      </div>
    </section>;
}

// ---------------- lightbox ----------------

export function Lightbox({
  ids,
  index,
  onIndex,
  onClose,
  onBook
}: {
  ids: string[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  onBook: (style: CutStyle) => void;
}) {
  const crown = useCrown();
  const reduce = useReducedMotion();
  const [dir, setDir] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const photo = index == null ? null : crown.gallery.find(p => p.id === ids[index]) ?? null;
  const go = (d: number) => {
    if (index == null || ids.length < 2) return;
    setDir(d);
    onIndex((index + d + ids.length) % ids.length);
  };
  useEffect(() => {
    if (index == null) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, [index == null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A quick flick is enough; no need to drag past a line.
  function onDragEnd(_: unknown, info: PanInfo) {
    const swipe = Math.abs(info.offset.x) * Math.abs(info.velocity.x);
    if (info.offset.x < -80 || swipe > 8000 && info.offset.x < 0) go(1);else if (info.offset.x > 80 || swipe > 8000 && info.offset.x > 0) go(-1);
  }
  return <AnimatePresence>
      {photo && index != null && <motion.div key="lightbox" data-lightbox role="dialog" aria-modal="true" aria-label="Photo viewer" initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} exit={{
      opacity: 0,
      transition: {
        duration: 0.18
      }
    }} className="fixed inset-0 z-[60] flex flex-col bg-[#060b22]/95 text-[#e6edf9] backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <span className="text-[17px] tabular-nums text-[#e6edf9]/80" aria-live="polite">
              {index + 1} of {ids.length}
            </span>
            <button ref={closeRef} type="button" onClick={onClose} className="press inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-white/10 px-4 text-[17px] font-semibold hover:bg-white/15">
              <X className="h-5 w-5" strokeWidth={1.75} /> Close
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 md:px-24">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.img key={photo.id} src={photo.src} alt={photo.caption || STYLE_LABELS[photo.style]} custom={dir} variants={{
            enter: (d: number) => ({
              opacity: 0,
              x: reduce ? 0 : d * 60
            }),
            center: {
              opacity: 1,
              x: 0
            },
            exit: (d: number) => ({
              opacity: 0,
              x: reduce ? 0 : d * -60
            })
          }} initial="enter" animate="center" exit="exit" transition={{
            type: 'spring',
            duration: 0.4,
            bounce: 0
          }} drag={ids.length > 1 ? 'x' : false} dragConstraints={{
            left: 0,
            right: 0
          }} dragElastic={0.5} onDragEnd={onDragEnd} className="max-h-full max-w-full cursor-grab touch-pan-y select-none rounded-sm bg-white p-2 object-contain shadow-2xl active:cursor-grabbing md:p-3" style={{
            maxHeight: 'calc(100dvh - 260px)'
          }} draggable={false} />
            </AnimatePresence>
            {ids.length > 1 && <>
                <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="press absolute left-4 top-1/2 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 md:flex">
                  <ArrowLeft className="h-6 w-6" strokeWidth={1.75} />
                </button>
                <button type="button" aria-label="Next photo" onClick={() => go(1)} className="press absolute right-4 top-1/2 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 md:flex">
                  <ArrowRight className="h-6 w-6" strokeWidth={1.75} />
                </button>
              </>}
          </div>

          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pb-8 pt-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-[26px] leading-tight">{photo.caption || STYLE_LABELS[photo.style]}</p>
              <p className="mt-1 font-sign text-[16px] font-semibold uppercase tracking-[0.08em] text-[#e6edf9]/65">{STYLE_LABELS[photo.style]}</p>
            </div>
            <div className="flex items-center gap-2">
              {ids.length > 1 && <>
                  <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="press flex h-[52px] w-[52px] items-center justify-center rounded-[10px] bg-white/10 md:hidden">
                    <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                  <button type="button" aria-label="Next photo" onClick={() => go(1)} className="press flex h-[52px] w-[52px] items-center justify-center rounded-[10px] bg-white/10 md:hidden">
                    <ArrowRight className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </>}
              <Pill variant="light" onClick={() => onBook(photo.style)} className="flex-1 md:flex-none">
                Book this cut
              </Pill>
            </div>
          </div>
        </motion.div>}
    </AnimatePresence>;
}