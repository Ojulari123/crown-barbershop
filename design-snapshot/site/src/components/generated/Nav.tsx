import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Navigation, Phone } from 'lucide-react';
import { SHOP, cx } from './data';
import { PAGES, href, useRoute } from './router';
import { EASE, Logo, Pill } from './ui';

// Everything except "Book", which is the button on the right.
const LINKS = PAGES.filter(p => p.path !== '/book');
export function Nav() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const route = useRoute();

  // close the menu whenever the page changes
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [open]);
  return <>
      <header className="sticky top-0 z-50 px-3 pt-3 md:px-6 md:pt-4">
        <nav aria-label="Main" className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 rounded-2xl bg-surface/85 pl-5 pr-2.5 shadow-[0_10px_40px_-18px_rgb(20_33_92/0.35)] ring-1 ring-line backdrop-blur-xl">
          <a href={href('/')} className="flex min-w-0 items-center gap-2.5 text-cobalt" aria-label="Crown Barber Shop, home page">
            <Logo className="-my-1 h-12 w-auto" />
            <span className="whitespace-nowrap font-display text-[19px] font-semibold tracking-tight text-ink">
              Crown <span className="font-normal italic">Barber Shop</span>
            </span>
          </a>

          <ul className="hidden items-center gap-0.5 lg:flex">
            {LINKS.map(l => {
            const active = route === l.path;
            return <li key={l.path}>
                  <a href={href(l.path)} aria-current={active ? 'page' : undefined} className={cx('relative block whitespace-nowrap rounded-lg px-3 py-2 text-[17px] font-medium transition-colors duration-200', active ? 'text-cobalt' : 'text-ink hover:bg-surface-2')}>
                    {l.label}
                    {active && <motion.span layoutId="nav-active" className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-cobalt" transition={{
                  type: 'spring',
                  duration: 0.4,
                  bounce: 0
                }} />}
                  </a>
                </li>;
          })}
          </ul>

          <div className="flex items-center gap-2">
            <a href={SHOP.phoneHref} className="press hidden items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[17px] font-semibold text-ink hover:bg-surface-2 md:inline-flex lg:hidden">
              <Phone className="h-4 w-4 text-cobalt" strokeWidth={1.75} />
              {SHOP.phoneDisplay}
            </a>
            <div className="hidden sm:block">
              <Pill href={href('/book')}>Reserve a chair</Pill>
            </div>
            <button type="button" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(v => !v)} className="press relative flex h-[52px] items-center gap-3 rounded-[10px] bg-surface-2 pl-4 pr-3 text-[17px] font-semibold text-ink lg:hidden">
              <span>{open ? 'Close' : 'Menu'}</span>
              <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
                <span className={cx('absolute h-[2px] w-5 bg-ink transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]', open ? 'rotate-45' : '-translate-y-[4px]')} />
                <span className={cx('absolute h-[2px] w-5 bg-ink transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]', open ? '-rotate-45' : 'translate-y-[4px]')} />
              </span>
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && <motion.div id="site-menu" key="menu" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0,
        transition: {
          duration: 0.18
        }
      }} transition={{
        duration: 0.3,
        ease: EASE
      }} className="fixed inset-0 z-[45] flex flex-col justify-end overflow-y-auto overscroll-contain bg-surface/95 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-28 backdrop-blur-2xl lg:hidden">
            <ul className="flex flex-col gap-1">
              {PAGES.map((l, i) => {
            const active = route === l.path;
            return <li key={l.path} className="overflow-hidden">
                    <motion.a href={href(l.path)} aria-current={active ? 'page' : undefined} initial={reduce ? {
                opacity: 0
              } : {
                y: '110%'
              }} animate={reduce ? {
                opacity: 1
              } : {
                y: 0
              }} transition={{
                duration: 0.5,
                delay: 0.05 + i * 0.05,
                ease: EASE
              }} className={cx('flex items-center gap-3 py-1 font-display text-[40px] leading-[1.15] tracking-tight', active ? 'text-cobalt' : 'text-ink')}>
                      {l.path === '/book' ? 'Reserve a chair' : l.label}
                      {active && <span className="font-sign text-[15px] font-semibold uppercase tracking-[0.1em]">You are here</span>}
                    </motion.a>
                  </li>;
          })}
            </ul>
            <motion.div initial={{
          opacity: 0,
          y: 12
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.4,
          duration: 0.4,
          ease: EASE
        }} className="mt-8">
              {/* the quick-action bar is covered by the menu, so its actions live here too */}
              <div className="grid grid-cols-2 gap-3">
                <a href={SHOP.phoneHref} className="press flex h-14 items-center justify-center gap-2 rounded-[10px] bg-surface text-[17px] font-semibold text-ink ring-2 ring-inset ring-ink/25 hover:bg-surface-2">
                  <Phone className="h-4 w-4 text-cobalt" strokeWidth={1.75} aria-hidden="true" /> Call
                </a>
                <a href={SHOP.mapsDirections} target="_blank" rel="noreferrer" className="press flex h-14 items-center justify-center gap-2 rounded-[10px] bg-surface text-[17px] font-semibold text-ink ring-2 ring-inset ring-ink/25 hover:bg-surface-2">
                  <Navigation className="h-4 w-4 text-cobalt" strokeWidth={1.75} aria-hidden="true" /> Directions
                </a>
              </div>
              <p className="mt-4 text-center text-[16px] tabular-nums text-ink-soft">{SHOP.phoneDisplay} · {SHOP.street}</p>
            </motion.div>
          </motion.div>}
      </AnimatePresence>
    </>;
}