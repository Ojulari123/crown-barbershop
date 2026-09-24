import { Fragment, type ReactNode } from 'react';
import { ArrowRight, Clock, MapPin, Navigation, Phone, Scissors } from 'lucide-react';
import { BARBERS, DAY_NAMES, SHOP, fmtRange, torontoNow } from './data';
import { href } from './router';
import { useCrown, visibleServices } from './store';
import { Hero } from './Hero';
import { Services } from './Services';
import { Booking } from './Booking';
import { Shop } from './Shop';
import { Reviews } from './Reviews';
import { Faq, Visit } from './Visit';
import { GalleryPage, GallerySection } from './Gallery';
import { Heading, Logo, Ornament, PageBand, Pill, Reveal } from './ui';
type OpenPhoto = (id: string, list: string[]) => void;

// Intro block for pages whose first section has no heading of its own.
function PageIntro({
  title,
  children
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return <section className="bg-surface px-5 pb-10 pt-14 md:px-8 md:pb-14 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <Heading level="h1" className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-7xl">
          {title}
        </Heading>
        <Ornament className="mt-5" />
        <p className="mt-4 max-w-[52ch] text-[19px] leading-relaxed text-ink-soft md:text-[20px]">{children}</p>
      </div>
    </section>;
}

// "Next step" band at the end of inner pages, so every page leads somewhere.
function NextStep({
  title,
  sub,
  to,
  cta,
  alt
}: {
  title: string;
  sub: string;
  to: string;
  cta: string;
  alt?: {
    to: string;
    label: string;
  };
}) {
  return <section className="bg-surface px-5 py-20 md:px-8 md:py-28">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-deep text-on-deep">
          {/* a corner of the shop floor */}
          <div className="checker-sm pointer-events-none absolute inset-y-0 right-0 w-2/5 opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden="true" />
          <div className="relative grid gap-8 p-7 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-10 md:p-12">
            <Logo className="h-20 w-auto md:h-28" />
            <div>
              <p className="font-display text-[34px] leading-[1.1] md:text-[44px]">{title}</p>
              <p className="mt-2 max-w-[46ch] text-[18px] leading-relaxed text-on-deep/80">{sub}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
              <Pill href={to} variant="light" className="w-full sm:w-auto">
                {cta}
              </Pill>
              {alt && <Pill href={alt.to} variant="outlineLight" className="w-full sm:w-auto">
                  {alt.label}
                </Pill>}
            </div>
          </div>
        </div>
      </Reveal>
    </section>;
}

// ---------- home-only pieces ----------

const POPULAR = ['classic', 'fade', 'cut-beard', 'kids'];
function HomePrices({
  onPick
}: {
  onPick: (id: string) => void;
}) {
  const crown = useCrown();
  const all = visibleServices(crown);
  const picks = POPULAR.map(id => all.find(s => s.id === id)).filter(Boolean) as typeof all;
  const list = picks.length ? picks : all.slice(0, 4);
  if (!list.length) return null;
  return <section className="bg-surface px-5 py-24 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <h2 className="text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">Most asked for</h2>
            <Ornament className="mt-5" />
          </Reveal>
          <Reveal delay={0.05}>
            <a href={href('/prices')} className="inline-flex min-h-[44px] items-center gap-2 text-[18px] font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-cobalt">
              See every price <ArrowRight className="h-5 w-5" strokeWidth={1.75} />
            </a>
          </Reveal>
        </div>
        {/* price tickets, like the cards tucked on the shop counter */}
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {list.map((s, i) => <Reveal as="li" key={s.id} delay={0.04 * i}>
              <button type="button" onClick={() => onPick(s.id)} className="press group flex h-full w-full items-center justify-between gap-4 rounded-[1.25rem] bg-surface-2 px-5 py-4 text-left ring-1 ring-line transition-colors duration-200 hover:ring-cobalt/50 sm:flex-col sm:items-stretch sm:p-6">
                <span>
                  <span className="block font-display text-[23px] leading-tight text-ink sm:text-[26px]">{s.name}</span>
                  <span className="mt-0.5 block text-[16px] text-ink-soft sm:mt-1 sm:text-[17px]">About {s.minutes} minutes</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5 sm:mt-8 sm:flex-row sm:items-end sm:justify-between sm:border-t-[3px] sm:border-double sm:border-line sm:pt-4">
                  <span className="font-sign text-[34px] font-semibold leading-none tabular-nums text-ink sm:text-[40px]">${s.price}</span>
                  <span className="inline-flex items-center gap-1.5 text-[17px] font-semibold text-cobalt underline decoration-cobalt/40 underline-offset-4 group-hover:decoration-cobalt">
                    Book <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </span>
                </span>
              </button>
            </Reveal>)}
        </ul>
      </div>
    </section>;
}
function VisitStrip() {
  const {
    hours
  } = useCrown();
  const {
    day
  } = torontoNow();
  const ranges = hours[day] ?? [];
  return <section className="bg-surface px-5 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="grid grid-cols-1 overflow-hidden rounded-[1.25rem] ring-1 ring-line md:grid-cols-3">
            <div className="flex gap-4 bg-surface-2 p-6 md:p-8">
              <Clock className="mt-1 h-6 w-6 shrink-0 text-cobalt" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h2 className="font-display text-[26px] leading-tight text-ink">Today, {DAY_NAMES[day]}</h2>
                <p className="mt-1 text-[18px] text-ink-soft">{ranges.length ? ranges.map((r, i) => <Fragment key={r[0]}>{i > 0 && ' and '}<span className="whitespace-nowrap">{fmtRange(r)}</span></Fragment>) : 'Closed today'}</p>
                <a href={href('/visit')} className="mt-3 inline-flex min-h-[44px] items-center text-[17px] font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-cobalt">
                  Full week's hours
                </a>
              </div>
            </div>
            <div className="flex gap-4 border-t border-line bg-surface p-6 md:border-l md:border-t-0 md:p-8">
              <MapPin className="mt-1 h-6 w-6 shrink-0 text-cobalt" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h2 className="text-balance font-display text-[26px] leading-tight text-ink">{SHOP.street}</h2>
                <p className="mt-1 text-[18px] text-ink-soft">At the corner of Speedvale, Guelph</p>
                <a href={SHOP.mapsDirections} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-[44px] items-center gap-2 text-[17px] font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-cobalt">
                  <Navigation className="h-4 w-4" strokeWidth={1.75} /> Get directions
                </a>
              </div>
            </div>
            <div className="flex gap-4 border-t border-line bg-deep p-6 text-on-deep md:border-l md:border-t-0 md:p-8">
              <Phone className="mt-1 h-6 w-6 shrink-0 text-on-deep/70" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h2 className="font-display text-[26px] leading-tight">Rather call?</h2>
                <p className="mt-1 text-[18px] text-on-deep/80">Ask how busy it is before you come in.</p>
                <a href={SHOP.phoneHref} className="mt-3 inline-flex min-h-[44px] items-center text-[20px] font-semibold tabular-nums underline decoration-on-deep/40 underline-offset-4 hover:decoration-on-deep">
                  {SHOP.phoneDisplay}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>;
}

// "Behind the chair": a proper profile per barber (photo, bio, specialties). Editable in the admin.
function Barbers({
  onBookWith
}: {
  onBookWith: (barberId: string) => void;
}) {
  const {
    barbers
  } = useCrown();
  const real = barbers.filter(b => b.id !== 'any');
  if (!real.length) return null;
  return <section className="slant-top overflow-hidden bg-deep px-5 pb-24 text-on-deep md:px-8 md:pb-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-6xl">Behind the chair</h2>
          <Ornament className="mt-5" tone="text-on-deep/70" />
        </Reveal>

        <div className="mt-14 grid gap-20">
          {real.map((b, i) => {
          const bio = b.bio?.trim() || BARBERS.find(x => x.id === b.id)?.bio || b.note;
          const flip = i % 2 === 1;
          return <Reveal key={b.id}>
                <article className="grid items-center gap-10 md:grid-cols-12 md:gap-16">
                  <div className={`mx-auto w-full max-w-[340px] md:col-span-5 md:max-w-none ${flip ? 'md:order-2' : ''}`}>
                    <div className="relative">
                      <div className="rounded-t-[999px] rounded-b-[1.5rem] bg-gradient-to-b from-[#dfe5ee] via-[#aeb9c9] to-[#8e9ab0] p-2.5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.8)]">
                        <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[calc(1.5rem-0.625rem)] bg-gradient-to-b from-[#eef3fa] to-[#c9d6ec]">
                          {b.photo ? <img src={b.photo} alt={`${b.name}, ${b.role || 'barber'} at Crown Barber Shop`} className="h-full w-full object-cover" loading="lazy" /> : <>
                              <span className="absolute inset-0 flex items-center justify-center pb-16 font-display text-[150px] italic leading-none text-[#14215c]" aria-hidden="true">
                                {b.name[0]}
                              </span>
                              <div className="absolute inset-x-0 bottom-0 h-1/3 [perspective:420px]" aria-hidden="true">
                                <div className="checker absolute -left-1/2 top-0 h-[220%] w-[200%] origin-top [transform:rotateX(62deg)] [background-size:44px_44px]" />
                              </div>
                            </>}
                        </div>
                      </div>
                      {/* name plate, like the brass plates on old barber stations */}
                      <div className="absolute -bottom-5 left-1/2 w-max -translate-x-1/2 rounded-lg bg-on-deep px-5 py-2 text-center text-deep shadow-[0_12px_30px_-10px_rgb(0_0_0/0.6)]">
                        <span className="font-sign text-[15px] font-semibold uppercase tracking-[0.16em]">{b.role || 'Barber'}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`md:col-span-7 ${flip ? 'md:order-1' : ''}`}>
                    <h3 className="font-display text-6xl leading-none md:text-7xl">{b.name}</h3>
                    <div className="mt-6 grid max-w-[52ch] gap-4 text-[19px] leading-relaxed text-on-deep/85">
                      {bio.split(/\n{2,}/).map((para, k) => <p key={k}>{para}</p>)}
                    </div>

                    {!!b.specialties?.length && <div className="mt-8">
                        <p className="font-sign text-[15px] font-semibold uppercase tracking-[0.14em] text-on-deep/60">Good at</p>
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {b.specialties.map(sp => <li key={sp} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.08] px-3.5 py-2 text-[16px] font-medium ring-1 ring-white/15">
                              <Scissors className="h-4 w-4 text-on-deep/60" strokeWidth={1.75} aria-hidden="true" />
                              {sp}
                            </li>)}
                        </ul>
                      </div>}

                    <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                      <Pill variant="light" onClick={() => onBookWith(b.id)} className="w-full sm:w-auto" icon={<Scissors className="h-5 w-5" strokeWidth={1.75} />}>
                        Book with {b.name}
                      </Pill>
                      <Pill href={SHOP.phoneHref} variant="outlineLight" className="w-full sm:w-auto" icon={<Phone className="h-5 w-5" strokeWidth={1.75} />}>
                        {SHOP.phoneDisplay}
                      </Pill>
                    </div>
                  </div>
                </article>
              </Reveal>;
        })}
        </div>
      </div>
    </section>;
}

// ---------- pages ----------

export function HomePage({
  onPick,
  onOpenPhoto
}: {
  onPick: (id: string) => void;
  onOpenPhoto: OpenPhoto;
}) {
  return <>
      <Hero />
      <HomePrices onPick={onPick} />
      <GallerySection onOpenPhoto={onOpenPhoto} />
      <Reviews />
      <VisitStrip />
    </>;
}
export function PricesPage({
  onPick
}: {
  onPick: (id: string) => void;
}) {
  return <>
      <PageBand label="Prices" />
      <Services level="h1" onPick={onPick} />
      <NextStep title="Know what you want?" sub="Reserve a time in about a minute, or just walk in any time we are open." to={href('/book')} cta="Reserve a chair" alt={{
      to: href('/gallery'),
      label: 'See recent cuts'
    }} />
    </>;
}
export function BookPage({
  serviceId,
  setServiceId,
  barberId
}: {
  serviceId: string | null;
  setServiceId: (id: string | null) => void;
  barberId: string | null;
}) {
  return <>
      <PageBand label="Reserve a chair" />
      <Booking level="h1" serviceId={serviceId} setServiceId={setServiceId} barberPreset={barberId} />
    </>;
}
export function GalleryRoute({
  onOpenPhoto
}: {
  onOpenPhoto: OpenPhoto;
}) {
  return <>
      <PageBand label="Gallery" />
      <PageIntro title="Recent cuts">
        Fresh work from the chair. Filter by style, tap a photo to see it up close, and book the one you like.
      </PageIntro>
      <GalleryPage onOpenPhoto={onOpenPhoto} />
    </>;
}
export function AboutPage({
  onBookWith
}: {
  onBookWith: (barberId: string) => void;
}) {
  return <>
      <PageBand label="About" />
      <Shop level="h1" />
      <Barbers onBookWith={onBookWith} />
      <Reviews />
      <NextStep title="Come see it for yourself." sub={`${SHOP.street}, at the corner of Speedvale. Walk in Tuesday to Saturday, cash only.`} to={href('/visit')} cta="Hours & map" alt={{
      to: href('/book'),
      label: 'Reserve a chair'
    }} />
    </>;
}
export function VisitPage() {
  return <>
      <PageBand label="Hours & map" />
      <Visit level="h1" />
      <Faq />
    </>;
}
export function NotFoundPage() {
  return <>
      <PageIntro title="We could not find that page.">
        The link may be old or mistyped. Try one of these instead, or call the shop at {SHOP.phoneDisplay}.
      </PageIntro>
      <section className="bg-surface px-5 pb-24 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row">
          <Pill href={href('/')} className="w-full sm:w-auto">
            Go to the home page
          </Pill>
          <Pill href={href('/prices')} variant="ghost" className="w-full sm:w-auto">
            See prices
          </Pill>
          <Pill href={href('/visit')} variant="ghost" className="w-full sm:w-auto">
            Hours & map
          </Pill>
        </div>
      </section>
    </>;
}