'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';
import { ArrowLeft, CalendarDays, Check, Loader2, Moon, Phone, Scissors, Sun, Sunrise } from 'lucide-react';
import { SHOP, cx, fmtTime, torontoNow } from '@/lib/data';
import { fmtYmd, hoursOn, isDayOff, isSlotTaken, relativeDay, createBooking, useCrown, visibleServices, ymdPlus, type CrownState } from '@/lib/store';
import { Calendar, type DayState } from '@/components/Calendar';
import { EASE, Heading, Ornament, Pill, Reveal } from '@/components/ui';
type Step = 'service' | 'barber' | 'day' | 'time' | 'details' | 'done';
const STEPS: {
  id: Exclude<Step, 'done'>;
  label: string;
}[] = [{
  id: 'service',
  label: 'Service'
}, {
  id: 'barber',
  label: 'Barber'
}, {
  id: 'day',
  label: 'Day'
}, {
  id: 'time',
  label: 'Time'
}, {
  id: 'details',
  label: 'Details'
}];
const BOOK_AHEAD_DAYS = 60;

// Every start time on a date for a service of `minutes`, marked taken or free.
function slotsOn(s: CrownState, ymd: string, minutes: number, barberId: string) {
  const now = torontoNow();
  const out: {
    m: number;
    taken: boolean;
  }[] = [];
  for (const [a, b] of hoursOn(s, ymd)) {
    for (let m = a; m + minutes <= b; m += 30) {
      if (ymd === now.ymd && m <= now.minutes + 20) continue;
      out.push({
        m,
        taken: isSlotTaken(s, ymd, m, barberId)
      });
    }
  }
  return out;
}
const PARTS = [{
  id: 'morning',
  label: 'Morning',
  icon: Sunrise,
  test: (m: number) => m < 720
}, {
  id: 'afternoon',
  label: 'Afternoon',
  icon: Sun,
  test: (m: number) => m >= 720 && m < 1020
}, {
  id: 'evening',
  label: 'Evening',
  icon: Moon,
  test: (m: number) => m >= 1020
}];
export function Booking({
  serviceId,
  setServiceId,
  barberPreset = null,
  level = 'h2'
}: {
  serviceId: string | null;
  setServiceId: (id: string | null) => void;
  barberPreset?: string | null;
  level?: 'h1' | 'h2';
}) {
  const reduce = useReducedMotion();
  const crown = useCrown();
  const services = visibleServices(crown);
  const [step, setStep] = useState<Step>(serviceId ? barberPreset ? 'day' : 'barber' : 'service');
  const [barberId, setBarberId] = useState<string | null>(barberPreset);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    form?: string;
  }>({});
  const [sending, setSending] = useState(false);

  // Service picked on the price board or in the gallery: jump ahead.
  const [lastExternal, setLastExternal] = useState(serviceId);
  if (serviceId !== lastExternal) {
    setLastExternal(serviceId);
    if (serviceId && step !== 'done') setStep(barberId ? 'day' : 'barber');
  }
  // "Book with Tania" from the About page.
  const [lastBarber, setLastBarber] = useState(barberPreset);
  if (barberPreset !== lastBarber) {
    setLastBarber(barberPreset);
    if (barberPreset) setBarberId(barberPreset);
  }
  const service = services.find(s => s.id === serviceId) ?? null;
  const barber = crown.barbers.find(b => b.id === barberId) ?? null;
  const minutes = service?.minutes ?? 30;
  const who = barberId ?? 'any';
  const today = torontoNow().ymd;
  const lastDay = ymdPlus(BOOK_AHEAD_DAYS);

  // First bookable date, so the calendar opens on something useful.
  const firstOpen = useMemo(() => {
    for (let i = 0; i <= BOOK_AHEAD_DAYS; i++) {
      const d = ymdPlus(i);
      if (slotsOn(crown, d, minutes, who).some(x => !x.taken)) return d;
    }
    return null;
  }, [crown, minutes, who]);
  const activeDate = date ?? firstOpen;
  const slots = activeDate ? slotsOn(crown, activeDate, minutes, who) : [];
  const stateOf = (ymd: string): DayState => {
    if (isDayOff(crown, ymd)) return 'off';
    const s = slotsOn(crown, ymd, minutes, who);
    if (!hoursOn(crown, ymd).length) return 'closed';
    return s.some(x => !x.taken) ? 'open' : 'full';
  };
  const stepIndex = STEPS.findIndex(s => s.id === step);

  // On a phone the next step can start above the screen; bring the card back into view.
  const card = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const top = card.current?.getBoundingClientRect().top ?? 0;
    if (top < 80) document.documentElement.scrollBy({
      top: top - 96,
      behavior: reduce ? 'auto' : 'smooth'
    });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => setStep(STEPS[Math.max(0, stepIndex - 1)].id);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Enter your name so the barber knows who to call.';
    if (phone.replace(/\D/g, '').length < 10) next.phone = 'Enter a 10-digit phone number, like 519 555 0142.';
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(first === 'name' ? 'bk-name' : 'bk-phone')?.focus();
      return;
    }
    if (!service || !barber || !activeDate || slot == null) return;
    if (isSlotTaken(crown, activeDate, slot, barber.id)) {
      setErrors({
        form: 'Someone just took that time. Pick another one and try again.'
      });
      setStep('time');
      setSlot(null);
      return;
    }
    setSending(true);
    // The shop's server re-checks hours, days off and double-booking (409 = someone got there first).
    const res = await createBooking({
      serviceId: service.id,
      barberId: barber.id,
      date: activeDate,
      time: slot,
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim()
    });
    setSending(false);
    if (!res.ok && res.reason === 'taken') {
      setErrors({
        form: 'Someone just took that time. Pick another one and try again.'
      });
      setStep('time');
      setSlot(null);
      return;
    }
    if (!res.ok) {
      setErrors({
        form: `We could not save your request. Please call ${SHOP.phoneDisplay} instead.`
      });
      return;
    }
    setStep('done');
  }
  function reset() {
    setServiceId(null);
    setBarberId(null);
    setDate(null);
    setSlot(null);
    setName('');
    setPhone('');
    setNote('');
    setErrors({});
    setStep('service');
  }
  const panel = {
    initial: reduce ? {
      opacity: 0
    } : {
      opacity: 0,
      x: 20
    },
    animate: {
      opacity: 1,
      x: 0
    },
    exit: reduce ? {
      opacity: 0
    } : {
      opacity: 0,
      x: -12,
      transition: {
        duration: 0.15
      }
    },
    transition: {
      duration: 0.3,
      ease: EASE
    }
  };
  const choice = (active: boolean) => cx('press w-full rounded-xl px-5 py-4 text-left text-[18px] ring-1 ring-inset transition-colors duration-200', active ? 'bg-cobalt text-on-cobalt ring-cobalt' : 'bg-surface ring-line hover:bg-surface-2 hover:ring-cobalt/40');
  const whenLabel = activeDate && slot != null ? `${relativeDay(activeDate) === 'Today' || relativeDay(activeDate) === 'Tomorrow' ? relativeDay(activeDate) : fmtYmd(activeDate, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })} at ${fmtTime(slot)}` : null;
  const receipt = [{
    k: 'Service',
    v: service ? `${service.name}, $${service.price}` : null,
    s: 'service' as const
  }, {
    k: 'Barber',
    v: barber?.name ?? null,
    s: 'barber' as const
  }, {
    k: 'When',
    v: whenLabel,
    s: 'day' as const
  }];
  return <section id="reserve" className={cx('bg-surface-2 px-5 pb-24 md:px-8 md:py-32', level === 'h1' ? 'pt-10' : 'pt-24')}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:gap-12 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-4">
          <Heading level={level} className="text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">
            Reserve a chair
          </Heading>
          <Ornament className="mt-5" />
          <p className="mt-4 max-w-[40ch] text-[19px] leading-relaxed text-ink-soft">Hold your spot in about a minute. Would rather just walk in? You still can, any time we are open.</p>

          {/* live receipt of choices (desktop; phones see the card's own progress) */}
          <div className="hidden lg:block">
          <dl className="mt-10 divide-y divide-line border-y border-line text-[17px]">
            {receipt.map(row => <div key={row.k} className="flex items-center justify-between gap-4 py-3.5">
                <dt className="text-ink-soft">{row.k}</dt>
                <dd className="flex items-center gap-3 text-right font-medium text-ink">
                  {row.v ?? <span className="text-ink-soft/70">Not chosen yet</span>}
                  {row.v && step !== 'done' && <button type="button" onClick={() => setStep(row.s)} className="text-[15px] font-semibold text-cobalt underline-offset-4 hover:underline">
                      Change
                    </button>}
                </dd>
              </div>)}
          </dl>
          <p className="mt-6 flex items-center gap-2 text-[16px] text-ink-soft">
            <Phone className="h-4 w-4 text-cobalt" strokeWidth={1.75} aria-hidden="true" />
            Prefer to talk to someone?{' '}
            <a href={SHOP.phoneHref} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-cobalt">
              {SHOP.phoneDisplay}
            </a>
          </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-8">
          <div ref={card} className="scroll-mt-24 rounded-[1.5rem] bg-ink/[0.04] p-1.5 ring-1 ring-line">
            <div className="overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface p-5 md:min-h-[560px] shadow-[0_30px_60px_-30px_rgb(20_33_92/0.35),inset_0_1px_1px_rgba(255,255,255,0.6)] md:p-8">
              {step !== 'done' && <ol className="mb-8 grid grid-cols-5 gap-2" aria-label="Booking progress">
                  {STEPS.map((s, i) => <li key={s.id} aria-current={s.id === step ? 'step' : undefined}>
                      <div className="h-1 overflow-hidden rounded-full bg-line">
                        <motion.div className="h-full origin-left bg-cobalt" initial={false} animate={{
                    scaleX: i <= stepIndex ? 1 : 0
                  }} transition={{
                    duration: 0.4,
                    ease: EASE
                  }} />
                      </div>
                      <span className={cx('mt-2 block text-[14px] font-medium', i <= stepIndex ? 'text-ink' : 'text-ink-soft')}>{s.label}</span>
                    </li>)}
                </ol>}

              {errors.form && step !== 'details' && <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-[16px] font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
                  {errors.form}
                </p>}

              <AnimatePresence mode="wait" initial={false}>
                {step === 'service' && <motion.div key="service" {...panel}>
                    <h3 className="font-display text-2xl text-ink">What are we doing today?</h3>
                    <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {services.map(s => <button key={s.id} type="button" className={choice(serviceId === s.id)} onClick={() => {
                    setServiceId(s.id);
                    setLastExternal(s.id);
                    setSlot(null);
                    setStep(barberId ? 'day' : 'barber');
                  }}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold">{s.name}</span>
                            <span className="font-sign text-xl font-semibold tabular-nums">${s.price}</span>
                          </span>
                          <span className={cx('mt-0.5 block text-[15px]', serviceId === s.id ? 'text-on-cobalt/80' : 'text-ink-soft')}>{s.minutes} min</span>
                        </button>)}
                    </div>
                  </motion.div>}

                {step === 'barber' && <motion.div key="barber" {...panel}>
                    <h3 className="font-display text-2xl text-ink">Who would you like?</h3>
                    <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                      {crown.barbers.map(b => <button key={b.id} type="button" className={choice(barberId === b.id)} onClick={() => {
                    setBarberId(b.id);
                    setSlot(null);
                    setStep('day');
                  }}>
                          <span className="flex items-center gap-4">
                            {b.photo ? <img src={b.photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg', barberId === b.id ? 'bg-white/15' : 'bg-surface-2 text-cobalt')}>
                                {b.id === 'any' ? <Scissors className="h-4 w-4" strokeWidth={1.75} /> : b.name[0]}
                              </span>}
                            <span>
                              <span className="block font-semibold">{b.name}</span>
                              <span className={cx('block text-[15px]', barberId === b.id ? 'text-on-cobalt/80' : 'text-ink-soft')}>{b.note}</span>
                            </span>
                          </span>
                        </button>)}
                    </div>
                    <BackButton onClick={back} />
                  </motion.div>}

                {step === 'day' && <motion.div key="day" {...panel}>
                    <h3 className="font-display text-2xl text-ink">Which day suits you?</h3>
                    <p className="mt-1 text-[16px] text-ink-soft">Days with a dot have open times.</p>
                    {!firstOpen ? <p className="mt-5 rounded-2xl bg-surface-2 p-5 text-[17px] text-ink-soft">
                        No open times in the next two months. Call the shop at {SHOP.phoneDisplay} and we will fit you in.
                      </p> : <div className="mt-6 flex justify-center rounded-2xl bg-surface-2/60 px-3 py-6 ring-1 ring-inset ring-line sm:px-6">
                        <Calendar value={activeDate} onChange={d => {
                    setDate(d);
                    setSlot(null);
                    setStep('time');
                  }} min={today} max={lastDay} stateOf={stateOf} label="Choose a day for your cut" legend />
                      </div>}
                    <BackButton onClick={back} />
                  </motion.div>}

                {step === 'time' && activeDate && <motion.div key="time" {...panel}>
                    {/* chosen day, with an easy way back to the calendar */}
                    <div className="flex flex-col gap-3 rounded-2xl bg-surface-2/60 px-5 py-4 ring-1 ring-inset ring-line sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-deep text-on-deep">
                          <span className="font-sign text-[12px] font-semibold uppercase tracking-[0.1em] opacity-75">{fmtYmd(activeDate, {
                          month: 'short'
                        })}</span>
                          <span className="font-display text-[24px] leading-none">{Number(activeDate.slice(8))}</span>
                        </span>
                        <span>
                          <span className="block font-display text-[22px] leading-tight text-ink">{fmtYmd(activeDate, {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric'
                        })}</span>
                          <span className="block text-[15px] text-ink-soft">
                            {service ? `${service.name}, about ${service.minutes} min` : 'About 30 min'}
                            {barber && barber.id !== 'any' ? ` with ${barber.name}` : ''}
                          </span>
                        </span>
                      </div>
                      <button type="button" onClick={() => setStep('day')} className="inline-flex min-h-[44px] items-center gap-2 self-start text-[16px] font-semibold text-cobalt underline decoration-cobalt/40 underline-offset-4 hover:decoration-cobalt sm:self-auto">
                        <CalendarDays className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Change day
                      </button>
                    </div>

                    <h3 className="mt-8 font-display text-2xl text-ink">Pick a time</h3>
                    {slots.every(x => x.taken) ? <p className="mt-4 rounded-xl bg-surface-2 p-4 text-[16px] text-ink-soft">Every time on this day is booked. Choose another day.</p> : <div className="mt-5 grid gap-7" role="radiogroup" aria-label="Time">
                        {PARTS.map(p => {
                    const list = slots.filter(x => p.test(x.m) && !x.taken);
                    if (!list.length) return null;
                    const Icon = p.icon;
                    return <div key={p.id}>
                              <p className="mb-3 flex items-center gap-2 border-b border-line pb-2 text-[16px] font-semibold text-ink">
                                <Icon className="h-4 w-4 text-cobalt" strokeWidth={1.75} aria-hidden="true" /> {p.label}
                                <span className="font-normal text-ink-soft">
                                  {list.length} open
                                </span>
                              </p>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {list.map(({
                          m
                        }) => <button key={m} type="button" role="radio" aria-checked={slot === m} onClick={() => {
                          setSlot(m);
                          setDate(activeDate);
                          setErrors({});
                          setStep('details');
                        }} className={cx('press h-14 rounded-xl text-[18px] font-semibold tabular-nums ring-1 ring-inset transition-colors duration-150', slot === m ? 'bg-cobalt text-on-cobalt ring-cobalt' : 'bg-surface text-ink ring-line hover:bg-surface-2 hover:ring-cobalt/50')}>
                                    {fmtTime(m)}
                                  </button>)}
                              </div>
                            </div>;
                  })}
                        {slots.some(x => x.taken) && <p className="text-[15px] text-ink-soft">{slots.filter(x => x.taken).length} other times that day are already booked.</p>}
                      </div>}
                    <BackButton onClick={back} />
                  </motion.div>}

                {step === 'details' && <motion.form key="details" {...panel} onSubmit={submit} noValidate>
                    {/* phones don't see the side receipt, so recap the choices here */}
                    <dl className="mb-6 divide-y divide-line rounded-2xl bg-surface-2/60 px-4 text-[16px] ring-1 ring-inset ring-line lg:hidden">
                      {receipt.map(row => <div key={row.k} className="flex items-center justify-between gap-3 py-1">
                          <dt className="text-ink-soft">{row.k}</dt>
                          <dd className="flex min-w-0 items-center gap-2.5 text-right font-medium text-ink">
                            <span>{row.v}</span>
                            <button type="button" onClick={() => setStep(row.s)} className="min-h-[44px] shrink-0 text-[15px] font-semibold text-cobalt underline-offset-4 hover:underline" aria-label={`Change ${row.k.toLowerCase()}`}>
                              Change
                            </button>
                          </dd>
                        </div>)}
                    </dl>
                    <h3 className="font-display text-2xl text-ink">Last thing, who is coming in?</h3>
                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      <Field label="Your name" id="bk-name" error={errors.name}>
                        <input id="bk-name" name="name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} className={inputCls(!!errors.name)} />
                      </Field>
                      <Field label="Phone number" id="bk-phone" hint="Only used to confirm or reschedule." error={errors.phone}>
                        <input id="bk-phone" name="phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" aria-invalid={!!errors.phone} className={inputCls(!!errors.phone)} />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Anything the barber should know? (optional)" id="bk-note">
                          <textarea id="bk-note" name="note" rows={3} value={note} onChange={e => setNote(e.target.value)} className={inputCls(false) + ' resize-none'} />
                        </Field>
                      </div>
                    </div>
                    {errors.form && <p role="alert" className="mt-5 text-[16px] font-medium text-red-700 dark:text-red-400">
                        {errors.form}
                      </p>}
                    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <BackButton onClick={back} inline />
                      <Pill type="submit" disabled={sending} className="w-full sm:w-auto" icon={sending ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} /> : undefined}>
                        {sending ? 'Sending…' : 'Request this time'}
                      </Pill>
                    </div>
                  </motion.form>}

                {step === 'done' && <motion.div key="done" {...panel} role="status" aria-live="polite" className="flex flex-col items-start justify-center py-4 md:min-h-[460px] md:py-0">
                    <motion.span initial={reduce ? {
                  opacity: 0
                } : {
                  scale: 0.6,
                  opacity: 0
                }} animate={{
                  scale: 1,
                  opacity: 1
                }} transition={{
                  type: 'spring',
                  duration: 0.5,
                  bounce: 0.3,
                  delay: 0.1
                }} className="flex h-14 w-14 items-center justify-center rounded-full bg-cobalt text-on-cobalt">
                      <Check className="h-6 w-6" strokeWidth={2} />
                    </motion.span>
                    <h3 className="mt-6 font-display text-3xl text-ink md:text-4xl">Request sent, {name.trim().split(' ')[0]}.</h3>
                    <p className="mt-3 max-w-[44ch] text-[18px] leading-relaxed text-ink-soft">
                      {service?.name} with {barber?.id === 'any' ? 'the first available barber' : barber?.name}, {whenLabel?.replace(/^(Today|Tomorrow)/, w => w.toLowerCase())}. The shop will call {phone} to confirm.
                      Remember to bring cash.
                    </p>
                    <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                      <Pill href="/visit" className="w-full sm:w-auto">Get directions</Pill>
                      <Pill variant="ghost" onClick={reset} className="w-full sm:w-auto">
                        Book someone else
                      </Pill>
                    </div>
                  </motion.div>}
              </AnimatePresence>
            </div>
          </div>
          <p className="mt-5 flex flex-wrap items-center gap-x-2 text-[16px] text-ink-soft lg:hidden">
            <Phone className="h-4 w-4 text-cobalt" strokeWidth={1.75} aria-hidden="true" />
            Prefer to talk to someone?
            <a href={SHOP.phoneHref} className="inline-flex min-h-[44px] items-center font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-cobalt">
              {SHOP.phoneDisplay}
            </a>
          </p>
        </Reveal>
      </div>
    </section>;
}
export function inputCls(err: boolean) {
  return cx('w-full rounded-[10px] bg-surface px-4 py-3.5 text-[19px] text-ink ring-2 ring-inset transition-shadow duration-200 focus:outline-none focus:ring-2', err ? 'ring-red-600 focus:ring-red-600 dark:ring-red-400' : 'ring-ink/20 focus:ring-cobalt');
}
export function Field({
  label,
  id,
  hint,
  error,
  children
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return <div className="grid gap-2">
      <label htmlFor={id} className="text-[17px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-[15px] text-ink-soft">
          {hint}
        </p>}
      <AnimatePresence>
        {error && <motion.p id={`${id}-err`} initial={{
        opacity: 0,
        y: -4
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0
      }} className="text-[15px] font-medium text-red-700 dark:text-red-400">
            {error}
          </motion.p>}
      </AnimatePresence>
    </div>;
}
function BackButton({
  onClick,
  inline
}: {
  onClick: () => void;
  inline?: boolean;
}) {
  return <button type="button" onClick={onClick} className={cx('inline-flex min-h-[44px] items-center gap-1.5 text-[16px] font-semibold text-ink-soft hover:text-ink', !inline && 'mt-6')}>
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back
    </button>;
}