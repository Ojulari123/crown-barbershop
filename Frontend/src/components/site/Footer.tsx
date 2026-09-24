'use client';

import { CalendarCheck, Navigation, Phone } from 'lucide-react';
import { SHOP } from '@/lib/data';
import { PAGES, href, useRoute } from '@/lib/links';
import { Logo, Pill } from '@/components/ui';

// Admin portal lives in its own MagicPath frame. Set to the portal's real URL at launch.
export const ADMIN_URL = '/admin';
const label = 'font-sign text-[16px] font-semibold uppercase tracking-[0.12em] text-on-deep/60';
const link = 'inline-flex min-h-[44px] items-center underline decoration-white/30 underline-offset-4 hover:decoration-white md:min-h-0';
export function Footer() {
  return <footer className="relative overflow-hidden bg-deep px-5 pb-32 pt-24 text-on-deep md:px-8 md:pb-10">
      {/* barber-pole stripe */}
      <div className="pole-stripe absolute inset-x-0 top-0 h-3" aria-hidden="true" />
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="max-w-[20ch] font-display text-4xl leading-[1.1] md:text-5xl">See you in the chair.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Pill href={href('/book')} variant="light">
                Reserve a chair
              </Pill>
              <a href={SHOP.phoneHref} className="press inline-flex min-h-[52px] items-center gap-2 rounded-[10px] px-5 text-[18px] font-semibold ring-2 ring-inset ring-white/25 hover:bg-white/5">
                <Phone className="h-4 w-4" strokeWidth={1.75} /> {SHOP.phoneDisplay}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-10 gap-y-8 text-[18px] min-[420px]:grid-cols-2 md:grid-cols-3">
            <nav aria-label="Footer">
              <p className={label}>Pages</p>
              <ul className="mt-1.5 grid grid-cols-2 gap-x-6 min-[420px]:grid-cols-1 md:mt-3 md:gap-2">
                {PAGES.map(p => <li key={p.path}>
                    <a href={href(p.path)} className={link}>
                      {p.path === '/book' ? 'Reserve a chair' : p.label}
                    </a>
                  </li>)}
              </ul>
            </nav>
            <div>
              <p className={label}>Find us</p>
              <address className="mt-3 not-italic leading-relaxed">
                {SHOP.street}
                <br />
                {SHOP.city}, {SHOP.region} {SHOP.postal}
              </address>
              <a href={href('/visit')} className={link + ' md:mt-2'}>
                This week's hours
              </a>
            </div>
            <div>
              <p className={label}>Pay</p>
              <p className="mt-3">Cash only</p>
              <p className={label + ' mt-6'}>Follow</p>
              <a href={SHOP.facebook} target="_blank" rel="noreferrer" className={link + ' mt-1 md:mt-3'}>
                Facebook
              </a>
            </div>
          </div>
        </div>

        {/* shop-window lettering */}
        <div className="mt-20 flex items-end gap-4 border-t border-white/10 pt-10 md:gap-8" aria-hidden="true">
          <Logo className="h-[15vw] max-h-48 w-auto shrink-0" />
          <span className="font-display text-[20vw] font-medium leading-[0.8] tracking-[-0.04em] text-on-deep/95 md:text-[15.5vw] lg:text-[200px]">Crown</span>
        </div>

        <div className="mt-10 flex flex-col-reverse gap-4 text-[15px] text-on-deep/60 md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Crown Barber Shop, Guelph, Ontario.{' '}
            <a href={ADMIN_URL} className="inline-flex min-h-[44px] items-center underline decoration-white/20 underline-offset-4 hover:text-on-deep md:min-h-0">
              Shop login
            </a>
          </p>
        </div>
      </div>
    </footer>;
}

// Thumb-reach actions on phones
export function MobileBar() {
  const route = useRoute();
  // The booking page has its own buttons; the bar would only cover the form.
  if (route === '/book') return null;
  const items = [{
    href: SHOP.phoneHref,
    label: 'Call',
    icon: Phone
  }, {
    href: SHOP.mapsDirections,
    label: 'Directions',
    icon: Navigation,
    external: true
  }, {
    href: href('/book'),
    label: 'Reserve',
    icon: CalendarCheck,
    primary: true
  }];
  return <nav aria-label="Quick actions" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden">
      <ul className="grid grid-cols-3 gap-1.5 rounded-2xl bg-surface/95 p-1.5 shadow-[0_16px_40px_-16px_rgb(20_33_92/0.45)] ring-1 ring-line backdrop-blur-xl">
        {items.map(it => {
        const Icon = it.icon;
        return <li key={it.label}>
              <a href={it.href} {...it.external ? {
            target: '_blank',
            rel: 'noreferrer'
          } : {}} className={'press flex h-14 items-center justify-center gap-2 rounded-xl text-[17px] font-semibold ' + (it.primary ? 'bg-cobalt text-on-cobalt' : 'text-ink hover:bg-surface-2')}>
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {it.label}
              </a>
            </li>;
      })}
      </ul>
    </nav>;
}