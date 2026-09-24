import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Info } from 'lucide-react';
import { Nav } from './Nav';
import { Footer, MobileBar } from './Footer';
import { Lightbox } from './Gallery';
import { AboutPage, BookPage, GalleryRoute, HomePage, NotFoundPage, PricesPage, VisitPage } from './Pages';
import { SHOP } from './data';
import { PAGES, navigate, useRoute, type Route } from './router';
import { STYLE_SERVICE, activeNotice, fmtYmd, useCrown, visibleServices, type CutStyle } from './store';
import { EASE, LOGO_SRC } from './ui';
const DAY_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Closure notices set in the admin portal, e.g. "Closed Saturday for the long weekend".
function NoticeBar() {
  const crown = useCrown();
  const n = activeNotice(crown);
  if (!n) return null;
  return <div role="status" className="relative z-50 bg-cobalt px-5 py-3 text-center text-[17px] font-medium text-on-cobalt">
      <span className="inline-flex items-center gap-2">
        <Info className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          {n.text}
          {n.until && <span className="opacity-80"> (until {fmtYmd(n.until, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })})</span>}
        </span>
      </span>
    </div>;
}
export const CrownBarberShopWebsite = () => {
  const route = useRoute();
  const crown = useCrown();
  const reduce = useReducedMotion();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    ids: string[];
    index: number;
  } | null>(null);
  const first = useRef(true);

  // New page: title, scroll to top, move focus to the page heading for screen readers.
  useEffect(() => {
    const page = PAGES.find(p => p.path === route);
    document.title = page?.title ?? 'Page not found | Crown Barber Shop';
    if (first.current) {
      first.current = false;
      return;
    }
    document.documentElement.scrollTo({
      top: 0,
      behavior: 'instant' as ScrollBehavior
    });
    const t = window.setTimeout(() => document.querySelector<HTMLElement>('main h1')?.focus({
      preventScroll: true
    }), 320);
    return () => window.clearTimeout(t);
  }, [route]);

  // Mascot as the browser-tab icon.
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = LOGO_SRC;
  }, []);

  // Lock page scroll while the photo viewer is open.
  useEffect(() => {
    if (!viewer) return;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [viewer]);
  function pick(id: string) {
    setServiceId(id);
    navigate('/book');
  }
  function bookWith(id: string) {
    setBarberId(id);
    navigate('/book');
  }
  function openPhoto(id: string, list: string[]) {
    setViewer({
      ids: list,
      index: Math.max(0, list.indexOf(id))
    });
  }
  function bookStyle(style: CutStyle) {
    setViewer(null);
    const target = STYLE_SERVICE[style];
    setServiceId(visibleServices(crown).some(s => s.id === target) ? target : null);
    navigate('/book');
  }
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BarberShop',
    name: SHOP.name,
    telephone: '+1-519-763-2229',
    priceRange: '$',
    paymentAccepted: 'Cash',
    address: {
      '@type': 'PostalAddress',
      streetAddress: SHOP.street,
      addressLocality: SHOP.city,
      addressRegion: SHOP.region,
      postalCode: SHOP.postal,
      addressCountry: 'CA'
    },
    sameAs: [SHOP.facebook],
    openingHoursSpecification: crown.hours.flatMap((ranges, d) => ranges.map(([a, b]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_SCHEMA[d],
      opens: hhmm(a),
      closes: hhmm(b)
    })))
  };
  const pages: Record<Route, ReactNode> = {
    '/': <HomePage onPick={pick} onOpenPhoto={openPhoto} />,
    '/prices': <PricesPage onPick={pick} />,
    '/book': <BookPage serviceId={serviceId} setServiceId={setServiceId} barberId={barberId} />,
    '/gallery': <GalleryRoute onOpenPhoto={openPhoto} />,
    '/about': <AboutPage onBookWith={bookWith} />,
    '/visit': <VisitPage />,
    '/not-found': <NotFoundPage />
  };
  return <div className="relative w-full min-w-0 bg-surface font-body text-ink antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify(schema)
    }} />
      <button type="button" onClick={() => document.querySelector<HTMLElement>('main h1')?.focus()} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-cobalt focus:px-4 focus:py-3 focus:text-on-cobalt">
        Skip to main content
      </button>
      <NoticeBar />
      <Nav />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={route} id="main" initial={{
        opacity: 0,
        y: reduce ? 0 : 8
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        transition: {
          duration: 0.14
        }
      }} transition={{
        duration: 0.3,
        ease: EASE
      }}>
          {pages[route]}
        </motion.main>
      </AnimatePresence>
      <Footer />
      <MobileBar />
      <Lightbox ids={viewer?.ids ?? []} index={viewer?.index ?? null} onIndex={index => setViewer(v => v ? {
      ...v,
      index
    } : v)} onClose={() => setViewer(null)} onBook={bookStyle} />
    </div>;
};