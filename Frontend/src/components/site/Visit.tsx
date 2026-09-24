'use client';

import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, MessageSquare, Minus, Navigation, Phone, Plus } from 'lucide-react';
import { DAY_NAMES, FAQS, SHOP, cx, fmtRange, fmtTime, torontoNow } from '@/lib/data';
import { fmtYmd, sendMessage, useCrown, type Hours } from '@/lib/store';
import { EASE, Heading, Ornament, Pill, Reveal } from '@/components/ui';
import { Field, inputCls } from './Booking';

// Monday first, the way the shop week reads.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

// "Closed for lunch 2 to 3 PM, Tuesday to Friday" worked out from the hours themselves.
function lunchNote(hours: Hours) {
  const gaps = new Map<string, number[]>();
  ORDER.forEach(d => {
    const r = hours[d] ?? [];
    if (r.length === 2) {
      const key = `${r[0][1]}-${r[1][0]}`;
      gaps.set(key, [...(gaps.get(key) ?? []), d]);
    }
  });
  if (gaps.size !== 1) return null;
  const [[key, days]] = [...gaps.entries()];
  const [a, b] = key.split('-').map(Number);
  const list = days.length > 2 ? `${DAY_NAMES[days[0]]} to ${DAY_NAMES[days[days.length - 1]]}` : days.map(d => DAY_NAMES[d]).join(' and ');
  return `Closed for lunch ${fmtTime(a).replace(' PM', '').replace(' AM', '')} to ${fmtTime(b)}, ${list}.`;
}
export function Visit({
  level = 'h2'
}: {
  level?: 'h1' | 'h2';
}) {
  const {
    hours,
    closures
  } = useCrown();
  const todayYmd = torontoNow().ymd;
  const daysOff = (closures ?? []).filter(d => d >= todayYmd).sort().slice(0, 6);
  const today = torontoNow().day;
  const [mapReady, setMapReady] = useState(false);
  const lunch = lunchNote(hours);
  return <section id="visit" className={cx('bg-surface px-5 pb-24 md:px-8 md:py-32', level === 'h1' ? 'pt-12' : 'pt-24')}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-10">
        <Reveal className="md:col-span-5">
          <Heading level={level} className="text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">Hours & map</Heading>
          <Ornament className="mt-5" />

          <table className="mt-8 w-full text-[18px]">
            <caption className="sr-only">Opening hours</caption>
            <tbody>
              {ORDER.map(d => {
              const ranges = hours[d] ?? [];
              const isToday = d === today;
              return <tr key={d} className={cx(isToday && 'bg-surface-2')} aria-current={isToday ? 'date' : undefined}>
                    <th scope="row" className={cx('rounded-l-xl py-3 pl-3 text-left font-medium', isToday ? 'text-ink' : 'text-ink-soft')}>
                      {DAY_NAMES[d]}
                      {isToday && <span className="ml-2 font-sign text-[15px] font-semibold uppercase tracking-[0.1em] text-cobalt">Today</span>}
                    </th>
                    <td className={cx('rounded-r-xl py-3 pr-3 text-right tabular-nums', isToday ? 'font-semibold text-ink' : 'text-ink')}>
                      {ranges.length ? ranges.map(r => <span key={r[0]} className="block">
                            {fmtRange(r)}
                          </span>) : <span className="text-ink-soft">Closed</span>}
                    </td>
                  </tr>;
            })}
            </tbody>
          </table>
          {lunch && <p className="mt-4 text-[16px] text-ink-soft">{lunch}</p>}
          {daysOff.length > 0 && <div className="mt-6 rounded-xl bg-red-50 px-4 py-3.5 text-red-900 ring-1 ring-inset ring-red-200 dark:bg-red-950/30 dark:text-red-200 dark:ring-red-400/25">
              <p className="text-[16px] font-semibold">Closed on these days</p>
              <ul className="mt-1.5 grid gap-0.5 text-[16px]">
                {daysOff.map(d => <li key={d}>{fmtYmd(d)}</li>)}
              </ul>
            </div>}
        </Reveal>

        <Reveal delay={0.1} className="md:col-span-7">
          <div className="rounded-[1.5rem] bg-gradient-to-b from-chrome/60 to-chrome/20 p-2 ring-1 ring-line">
            <div className="overflow-hidden rounded-[calc(1.5rem-0.5rem)] bg-surface-2">
              <div className="relative aspect-[4/3] w-full md:aspect-[16/11]">
                {!mapReady && <div className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden="true" />}
                <iframe title="Map showing Crown Barber Shop at 219 Silvercreek Parkway North, Guelph" src={SHOP.mapsEmbed} loading="lazy" onLoad={() => setMapReady(true)} referrerPolicy="no-referrer-when-downgrade" className={cx('absolute inset-0 h-full w-full border-0 transition-opacity duration-500 dark:invert-[0.9] dark:hue-rotate-180', mapReady ? 'opacity-100' : 'opacity-0')} />
              </div>
              <div className="flex flex-col gap-5 bg-surface p-6 md:flex-row md:items-center md:justify-between">
                <address className="not-italic">
                  <span className="block text-[18px] font-semibold text-ink">{SHOP.street}</span>
                  <span className="block text-[17px] text-ink-soft">
                    {SHOP.city}, {SHOP.region} {SHOP.postal}, {SHOP.landmark}
                  </span>
                </address>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Pill href={SHOP.mapsDirections} external className="w-full sm:w-auto" icon={<Navigation className="h-5 w-5" strokeWidth={1.75} />}>
                    Get directions
                  </Pill>
                  <Pill href={SHOP.phoneHref} variant="ghost" className="w-full sm:w-auto" icon={<Phone className="h-5 w-5 text-cobalt" strokeWidth={1.75} />}>
                    Call
                  </Pill>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>;
}
export function Faq({
  level = 'h2'
}: {
  level?: 'h1' | 'h2';
}) {
  const [open, setOpen] = useState<number | null>(0);
  return <section id="faq" className="bg-surface-2 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <Heading level={level} className="text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">Good to know</Heading>
          <Ornament className="mt-5" />
        </Reveal>
        <Reveal delay={0.05} className="mt-10">
          <ul className="grid gap-2">
            {FAQS.map((f, i) => {
            const isOpen = open === i;
            return <li key={f.q} className="rounded-[1.25rem] bg-surface ring-1 ring-line">
                  <h3>
                    <button type="button" aria-expanded={isOpen} aria-controls={`faq-${i}`} onClick={() => setOpen(isOpen ? null : i)} className="flex min-h-[64px] w-full items-center justify-between gap-6 px-6 py-5 text-left font-body text-[19px] font-semibold text-ink">
                      {f.q}
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-cobalt">
                        {isOpen ? <Minus className="h-4 w-4" strokeWidth={2} /> : <Plus className="h-4 w-4" strokeWidth={2} />}
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && <motion.div id={`faq-${i}`} initial={{
                  height: 0,
                  opacity: 0
                }} animate={{
                  height: 'auto',
                  opacity: 1
                }} exit={{
                  height: 0,
                  opacity: 0
                }} transition={{
                  duration: 0.28,
                  ease: EASE
                }} className="overflow-hidden">
                        <p className="max-w-[60ch] px-6 pb-6 text-[18px] leading-relaxed text-ink-soft">{f.a}</p>
                      </motion.div>}
                  </AnimatePresence>
                </li>;
          })}
          </ul>
        </Reveal>
        <Reveal delay={0.05} className="mt-12">
          <AskForm />
        </Reveal>
      </div>
    </section>;
}

// Messages land in the admin portal's inbox.
function AskForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    body?: string;
    form?: string;
  }>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Enter your name.';
    if (phone.replace(/\D/g, '').length < 10) next.phone = 'Enter a 10-digit phone number so we can call you back.';
    if (body.trim().length < 5) next.body = 'Write your question in a few words.';
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`ask-${first}`)?.focus();
      return;
    }
    setState('sending');
    const res = await sendMessage({
      name: name.trim(),
      phone: phone.trim(),
      body: body.trim()
    });
    if (!res.ok) {
      setErrors({
        form: `Your message could not be saved. Please call ${SHOP.phoneDisplay}.`
      });
      setState('idle');
      return;
    }
    setState('sent');
  }
  return <div className="rounded-[1.25rem] bg-deep p-6 text-on-deep md:p-10">
      <AnimatePresence mode="wait" initial={false}>
        {state === 'sent' ? <motion.div key="sent" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} role="status" aria-live="polite">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-on-deep text-deep">
              <Check className="h-6 w-6" strokeWidth={2} />
            </span>
            <h3 className="mt-5 font-display text-3xl">Thanks, {name.trim().split(' ')[0]}.</h3>
            <p className="mt-2 max-w-[44ch] text-[18px] leading-relaxed text-on-deep/80">The shop will call you back at {phone}, usually the same day we are open.</p>
            <button type="button" onClick={() => {
          setBody('');
          setState('idle');
        }} className="mt-6 min-h-[44px] text-[17px] font-semibold underline decoration-on-deep/40 underline-offset-4 hover:decoration-on-deep">
              Ask something else
            </button>
          </motion.div> : <motion.form key="form" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} onSubmit={submit} noValidate>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-on-deep/70" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="font-display text-3xl">Still have a question?</h3>
            </div>
            <p className="mt-2 text-[18px] text-on-deep/80">Leave a message and the shop will call you back.</p>
            {/* light fields on the navy card */}
            <div className="mt-6 grid gap-5 rounded-xl bg-surface p-5 text-ink md:grid-cols-2">
              <Field label="Your name" id="ask-name" error={errors.name}>
                <input id="ask-name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} aria-invalid={!!errors.name} className={inputCls(!!errors.name)} />
              </Field>
              <Field label="Phone number" id="ask-phone" error={errors.phone}>
                <input id="ask-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} aria-invalid={!!errors.phone} className={inputCls(!!errors.phone)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Your question" id="ask-body" error={errors.body}>
                  <textarea id="ask-body" name="message" rows={3} value={body} onChange={e => setBody(e.target.value)} aria-invalid={!!errors.body} className={inputCls(!!errors.body) + ' resize-none'} />
                </Field>
              </div>
              {errors.form && <p role="alert" className="text-[16px] font-medium text-red-700 md:col-span-2">
                  {errors.form}
                </p>}
              <div className="md:col-span-2">
                <Pill type="submit" disabled={state === 'sending'} className="w-full sm:w-auto" icon={state === 'sending' ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} /> : undefined}>
                  {state === 'sending' ? 'Sending…' : 'Send message'}
                </Pill>
              </div>
            </div>
          </motion.form>}
      </AnimatePresence>
    </div>;
}