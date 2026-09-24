'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CalendarPlus, Check, Coffee, DoorOpen, Footprints, Inbox, Megaphone, Phone, Scissors, X } from 'lucide-react';
import { DAY_NAMES, cx, fmtRange, fmtTime, torontoNow } from '@/lib/data';
import { activeNotice, dayOfYmd, fmtYmd, hoursOn, isDayOff, relativeDay, setSlice, uid, useCrown, ymdPlus, type Booking } from '@/lib/store';
import { BookingDetail, BookingForm, describe, useBookingActions } from './Bookings';
import { Avatar, Button, Drawer, Empty, Field, IconButton, PageHeader, Panel, STATUS, inputCls, telHref, timeAgo, useToast } from './kit';
import type { View } from './CrownShopAdmin';
const PX = 1.7; // pixels per minute in the appointment book
const greeting = (m: number) => m < 720 ? 'Good morning' : m < 1020 ? 'Good afternoon' : 'Good evening';
const money = (n: number) => `$${n.toLocaleString('en-CA')}`;
const BLOCK: Record<Booking['status'], string> = {
  requested: 'bg-amber-50 border-amber-400 dark:bg-amber-400/10',
  confirmed: 'bg-accent-soft border-accent',
  done: 'bg-emerald-50 border-emerald-500 dark:bg-emerald-400/10',
  cancelled: 'bg-sunken border-stroke-strong',
  'no-show': 'bg-red-50 border-red-500 dark:bg-red-400/10'
};
export function TodayView({
  go,
  openMessage
}: {
  go: (v: View) => void;
  openMessage: (id: string) => void;
}) {
  const crown = useCrown();
  const setStatus = useBookingActions();
  const now = torontoNow();
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState<{
    open: boolean;
    editing: Booking | null;
    preset?: Partial<Booking>;
  }>({
    open: false,
    editing: null
  });
  const [walkIn, setWalkIn] = useState(false);
  const edit = (b: Booking) => {
    setDetail(null);
    setForm({
      open: true,
      editing: b
    });
  };
  const hours = hoursOn(crown, now.ymd);
  const offToday = isDayOff(crown, now.ymd);
  const todays = crown.bookings.filter(b => b.date === now.ymd && b.status !== 'cancelled').sort((a, b) => a.time - b.time);
  const requests = crown.bookings.filter(b => b.status === 'requested').sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time);
  const inbox = crown.messages.filter(m => !m.archived).sort((a, b) => b.createdAt - a.createdAt);
  const unread = inbox.filter(m => !m.read).length;
  const notice = activeNotice(crown);
  const price = (b: Booking) => crown.services.find(s => s.id === b.serviceId)?.price ?? 0;
  const billable = todays.filter(b => b.status !== 'no-show');
  const cashExpected = billable.reduce((s, b) => s + price(b), 0);
  const cashTaken = billable.filter(b => b.status === 'done').reduce((s, b) => s + price(b), 0);
  const doneCount = todays.filter(b => b.status === 'done').length;
  const walkIns = todays.filter(b => b.source === 'walk-in').length;
  const openNow = hours.find(([a, b]) => now.minutes >= a && now.minutes < b);
  const week = useMemo(() => {
    const mon = -((now.day + 6) % 7);
    return Array.from({
      length: 7
    }, (_, i) => {
      const ymd = ymdPlus(mon + i);
      return {
        ymd,
        dow: dayOfYmd(ymd),
        open: hoursOn(crown, ymd).length > 0,
        n: crown.bookings.filter(b => b.date === ymd && b.status !== 'cancelled').length
      };
    });
  }, [crown, now.day]);
  const stats = [{
    label: 'Cuts today',
    value: `${doneCount}/${todays.length}`,
    sub: todays.length ? `${todays.length - doneCount} still to come` : 'Nothing booked yet',
    icon: Scissors
  }, {
    label: 'Cash to expect',
    value: money(cashExpected),
    sub: `${money(cashTaken)} taken so far`,
    icon: Banknote
  }, {
    label: 'Walk-ins',
    value: String(walkIns),
    sub: 'Logged today',
    icon: Footprints
  }, {
    label: 'Waiting on you',
    value: String(requests.length + unread),
    sub: `${requests.length} to confirm · ${unread} messages`,
    icon: Inbox,
    alert: requests.length + unread > 0,
    to: (requests.length ? 'bookings' : 'messages') as View
  }];
  return <>
      <PageHeader title={greeting(now.minutes)} description={<span className="flex flex-wrap items-center gap-x-2">
            {fmtYmd(now.ymd, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })}
            <span aria-hidden="true">·</span>
            <span className={cx('inline-flex items-center gap-1.5 font-medium', openNow ? 'text-emerald-700 dark:text-emerald-300' : 'text-fg-muted')}>
              <span className={cx('h-2 w-2 rounded-full', openNow ? 'bg-emerald-500' : 'bg-fg-subtle')} aria-hidden="true" />
              {offToday ? 'Day off' : openNow ? `Open until ${fmtTime(openNow[1])}` : hours.length ? 'Closed right now' : 'Closed today'}
            </span>
          </span>} actions={<>
            <Button variant="secondary" icon={<CalendarPlus className="h-4 w-4" strokeWidth={1.75} />} onClick={() => setForm({
        open: true,
        editing: null
      })}>
              New booking
            </Button>
            <Button variant="primary" icon={<Footprints className="h-4 w-4" strokeWidth={1.75} />} onClick={() => setWalkIn(true)} disabled={!hours.length}>
              Log a walk-in
            </Button>
          </>} />

      {notice && <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent-soft px-4 py-2.5 text-[13px] text-fg">
          <span className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden="true" />
            <span>
              <span className="font-medium">On the website:</span> {notice.text}
            </span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => go('hours')}>
            Edit
          </Button>
        </div>}

      {/* the till: barbershop numbers at a glance */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-stroke bg-panel lg:grid-cols-4">
        {stats.map((s, i) => {
        const Icon = s.icon;
        const body = <>
              <span className="flex w-full items-center justify-between text-[12px] font-medium text-fg-subtle">
                {s.label}
                <Icon className={cx('h-4 w-4', s.alert ? 'text-amber-500' : 'text-fg-subtle')} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="num mt-1 font-display text-[30px] leading-none text-fg">{s.value}</span>
              <span className="mt-1.5 text-[12px] text-fg-subtle">{s.sub}</span>
            </>;
        const cls = cx('flex flex-col items-start border-stroke px-4 py-4 text-left', i % 2 === 1 && 'border-l', i >= 2 && 'border-t lg:border-t-0', i === 2 && 'lg:border-l');
        return s.to ? <button key={s.label} type="button" onClick={() => go(s.to!)} className={cx(cls, 'hover:bg-sunken')}>
              {body}
            </button> : <div key={s.label} className={cls}>
              {body}
            </div>;
      })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title={<div className="flex items-baseline gap-2">
              <h2 className="text-[14px] font-semibold text-fg">Appointment book</h2>
              <span className="text-[12px] text-fg-subtle">{hours.length ? hours.map(fmtRange).join(', ') : DAY_NAMES[now.day]}</span>
            </div>} action={<Button size="sm" variant="ghost" onClick={() => go('bookings')}>
              All bookings
            </Button>}>
          {!hours.length ? <Empty compact icon={<Coffee className="h-5 w-5" strokeWidth={1.75} />} title={offToday ? 'Day off today' : 'Closed today'} body={offToday ? 'Marked as a day off under Hours & notices.' : 'No opening hours today. Enjoy it.'} /> : <DayBook ranges={hours} bookings={todays} nowMin={now.minutes} onOpen={id => setDetail(id)} onEmpty={time => setForm({
          open: true,
          editing: null,
          preset: {
            date: now.ymd,
            time
          }
        })} describeB={b => describe(crown, b)} onQuick={b => setStatus(b, b.status === 'requested' ? 'confirmed' : 'done')} />}
        </Panel>

        <div className="grid content-start gap-4">
          <Panel title={<div className="flex items-center gap-2">
                <h2 className="text-[14px] font-semibold text-fg">Needs a reply</h2>
                {requests.length > 0 && <span className="num rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">{requests.length}</span>}
              </div>}>
            {requests.length === 0 ? <p className="px-4 py-5 text-[13px] text-fg-subtle">No booking requests waiting.</p> : <ul className="divide-y divide-stroke">
                {requests.slice(0, 4).map(b => {
              const d = describe(crown, b);
              return <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                      <button type="button" onClick={() => setDetail(b.id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[13px] font-medium text-fg hover:underline">{b.name}</span>
                        <span className="num block truncate text-[12px] text-fg-subtle">
                          {relativeDay(b.date)}, {fmtTime(b.time)} · {d.service}
                        </span>
                      </button>
                      <IconButton label={`Decline ${b.name}`} size="sm" icon={<X className="h-4 w-4" strokeWidth={2} />} onClick={() => setStatus(b, 'cancelled')} />
                      <IconButton label={`Confirm ${b.name}`} size="sm" variant="primary" icon={<Check className="h-4 w-4" strokeWidth={2} />} onClick={() => setStatus(b, 'confirmed')} />
                    </li>;
            })}
              </ul>}
          </Panel>

          <Panel title="Messages" action={<Button size="sm" variant="ghost" onClick={() => go('messages')}>
                Inbox
              </Button>}>
            {inbox.length === 0 ? <Empty compact icon={<Inbox className="h-5 w-5" strokeWidth={1.75} />} title="Inbox clear" /> : <ul className="divide-y divide-stroke">
                {inbox.slice(0, 3).map(m => <li key={m.id} className="flex items-start gap-3 px-4 py-2.5">
                    <Avatar name={m.name} size="sm" />
                    <button type="button" onClick={() => openMessage(m.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cx('truncate text-[13px]', m.read ? 'text-fg' : 'font-semibold text-fg')}>{m.name}</span>
                        <span className="num shrink-0 text-[11px] text-fg-subtle">{timeAgo(m.createdAt)}</span>
                      </span>
                      <span className="line-clamp-1 text-[12px] text-fg-subtle">{m.body}</span>
                    </button>
                    <IconButton label={`Call ${m.name}`} size="sm" icon={<Phone className="h-4 w-4" strokeWidth={1.75} />} onClick={() => window.location.href = telHref(m.phone)} />
                  </li>)}
              </ul>}
          </Panel>

          <WeekChart week={week} today={now.ymd} />
        </div>
      </div>

      <BookingDetail id={detail} onClose={() => setDetail(null)} onEdit={edit} />
      <BookingForm open={form.open} editing={form.editing} preset={form.preset} onClose={() => setForm(f => ({
      ...f,
      open: false
    }))} />
      <WalkInDrawer open={walkIn} onClose={() => setWalkIn(false)} />
    </>;
}

// ---------- appointment book ----------

function DayBook({
  ranges,
  bookings,
  nowMin,
  onOpen,
  onEmpty,
  describeB,
  onQuick
}: {
  ranges: [number, number][];
  bookings: Booking[];
  nowMin: number;
  onOpen: (id: string) => void;
  onEmpty: (time: number) => void;
  describeB: (b: Booking) => {
    service: string;
    minutes: number;
    barber: string;
  };
  onQuick: (b: Booking) => void;
}) {
  const start = Math.min(...ranges.map(r => r[0]));
  const end = Math.max(...ranges.map(r => r[1]));
  const height = (end - start) * PX;
  const scroller = useRef<HTMLDivElement>(null);
  const y = (m: number) => (m - start) * PX;

  // open on "now" rather than the top of the day
  useEffect(() => {
    if (scroller.current && nowMin > start && nowMin < end) scroller.current.scrollTop = Math.max(0, y(nowMin) - 120);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const slots: number[] = [];
  for (const [a, b] of ranges) for (let m = a; m < b; m += 30) slots.push(m);
  const busy = (m: number) => bookings.some(bk => m < bk.time + describeB(bk).minutes && m + 30 > bk.time && bk.status !== 'no-show');

  // side-by-side lanes when two people are booked at the same time (two barbers)
  const lanes = new Map<string, {
    lane: number;
    of: number;
  }>();
  bookings.forEach(b => {
    const overl = bookings.filter(o => o.time < b.time + describeB(b).minutes && b.time < o.time + describeB(o).minutes);
    lanes.set(b.id, {
      lane: overl.indexOf(b),
      of: overl.length
    });
  });
  const gaps = ranges.slice(1).map((r, i) => [ranges[i][1], r[0]] as [number, number]);
  const hourMarks: number[] = [];
  for (let m = Math.ceil(start / 60) * 60; m <= end; m += 60) hourMarks.push(m);
  return <div ref={scroller} className="max-h-[560px] overflow-y-auto">
      <div className="relative my-3 ml-16 mr-3" style={{
      height
    }}>
        {hourMarks.map(m => <div key={m} className="absolute inset-x-0 border-t border-stroke" style={{
        top: y(m)
      }}>
            <span className="num absolute -left-16 -top-2 w-14 pr-2 text-right text-[11px] font-medium text-fg-subtle">{fmtTime(m)}</span>
          </div>)}
        {slots.map(m => <div key={'h' + m} className="absolute inset-x-0 border-t border-dashed border-stroke/60" style={{
        top: y(m)
      }} aria-hidden="true" />)}

        {/* open half-hours: tap to book */}
        {slots.filter(m => !busy(m)).map(m => <button key={'s' + m} type="button" onClick={() => onEmpty(m)} aria-label={`Book ${fmtTime(m)}`} className="absolute inset-x-0 flex items-center rounded-md px-3 text-[12px] font-medium text-transparent hover:bg-accent-soft hover:text-accent focus-visible:bg-accent-soft focus-visible:text-accent" style={{
        top: y(m) + 2,
        height: 30 * PX - 4
      }}>
              + Book {fmtTime(m)}
            </button>)}

        {/* lunch / breaks */}
        {gaps.map(([a, b]) => <div key={'g' + a} className="absolute inset-x-0 flex items-center justify-center rounded-md text-[12px] font-medium text-fg-subtle" style={{
        top: y(a) + 2,
        height: (b - a) * PX - 4,
        backgroundImage: 'repeating-linear-gradient(135deg, var(--a-sunken) 0 8px, transparent 8px 16px)'
      }}>
            <Coffee className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Lunch break
          </div>)}

        {bookings.map(b => {
        const d = describeB(b);
        const l = lanes.get(b.id)!;
        const h = Math.max(d.minutes * PX - 4, 38);
        const canQuick = b.status === 'requested' || b.status === 'confirmed' && b.time <= nowMin + 15;
        return <div key={b.id} className={cx('absolute overflow-hidden rounded-md border-l-[3px] shadow-[0_1px_2px_rgb(16_24_40/0.06)]', BLOCK[b.status], b.status === 'done' && 'opacity-75')} style={{
          top: y(b.time) + 2,
          height: h,
          left: `${l.lane / l.of * 100}%`,
          width: `calc(${100 / l.of}% - 4px)`
        }}>
              <button type="button" onClick={() => onOpen(b.id)} className="flex h-full w-full flex-col items-start px-2.5 py-1.5 pr-24 text-left">
                <span className="flex w-full items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-fg">{b.name}</span>
                  {b.source === 'walk-in' && <Footprints className="h-3.5 w-3.5 shrink-0 text-fg-subtle" strokeWidth={1.75} aria-label="walk-in" />}
                </span>
                <span className="num truncate text-[12px] text-fg-muted">
                  {fmtTime(b.time)} · {d.service}
                  {l.of === 1 && ` · ${d.barber}`}
                </span>
                {h > 60 && <span className="mt-auto text-[11px] font-medium text-fg-subtle">{STATUS[b.status].label}</span>}
              </button>
              {canQuick && <button type="button" onClick={() => onQuick(b)} className="absolute right-1.5 top-1.5 inline-flex h-7 items-center gap-1 rounded-md bg-panel px-2 text-[12px] font-medium text-fg shadow-sm ring-1 ring-stroke hover:bg-sunken pointer-coarse:h-9">
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  {b.status === 'requested' ? 'Confirm' : 'Done'}
                </button>}
            </div>;
      })}

        {nowMin > start && nowMin < end && <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{
        top: y(nowMin)
      }}>
            <span className="-ml-1.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-panel" />
            <span className="h-[2px] flex-1 bg-red-500" />
            <span className="num absolute -left-16 w-14 pr-2 text-right text-[11px] font-semibold text-red-600">{fmtTime(nowMin - nowMin % 5)}</span>
          </div>}
      </div>
    </div>;
}

// ---------- walk-in logger ----------

function WalkInDrawer({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const crown = useCrown();
  const toast = useToast();
  const services = crown.services.filter(s => s.visible !== false);
  const barbers = crown.barbers.filter(b => b.id !== 'any');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? 'any');
  const [name, setName] = useState('');
  function save() {
    const n = torontoNow();
    const svc = services.find(s => s.id === serviceId);
    setSlice('bookings', l => [...l, {
      id: uid(),
      createdAt: Date.now(),
      name: name.trim() || 'Walk-in',
      phone: '',
      note: '',
      serviceId,
      barberId,
      date: n.ymd,
      time: n.minutes - n.minutes % 5,
      status: 'done',
      source: 'walk-in'
    }]);
    toast({
      text: `Walk-in logged · ${svc?.name ?? 'cut'}${svc ? ` · ${money(svc.price)} cash` : ''}`
    });
    setName('');
    onClose();
  }
  return <Drawer open={open} onClose={onClose} title="Log a walk-in" subtitle="Adds a finished cut to today's book and the cash total." footer={<>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<DoorOpen className="h-4 w-4" strokeWidth={1.75} />} onClick={save}>
            Log walk-in
          </Button>
        </>}>
      <fieldset>
        <legend className="text-[13px] font-medium text-fg">What did they get?</legend>
        <div className="mt-2 grid gap-1.5">
          {services.map(s => <label key={s.id} className={cx('flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset pointer-coarse:py-3', serviceId === s.id ? 'bg-accent-soft ring-accent' : 'ring-stroke hover:bg-sunken')}>
              <span className="flex items-center gap-2.5">
                <input type="radio" name="walkin-service" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} className="accent-[var(--a-accent)]" />
                <span className="text-[14px] font-medium text-fg">{s.name}</span>
              </span>
              <span className="num text-[14px] font-semibold text-fg">{money(s.price)}</span>
            </label>)}
        </div>
      </fieldset>
      {barbers.length > 1 && <Field label="Barber" id="wi-barber" className="mt-4">
          <select id="wi-barber" className={inputCls()} value={barberId} onChange={e => setBarberId(e.target.value)}>
            {barbers.map(b => <option key={b.id} value={b.id}>
                {b.name}
              </option>)}
          </select>
        </Field>}
      <Field label="Name (optional)" id="wi-name" className="mt-4" hint="Leave blank for a quick walk-in.">
        <input id="wi-name" className={inputCls()} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
      </Field>
    </Drawer>;
}

// ---------- week chart (one series: counts on the bars, hover for the date) ----------

function WeekChart({
  week,
  today
}: {
  week: {
    ymd: string;
    dow: number;
    open: boolean;
    n: number;
  }[];
  today: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...week.map(d => d.n));
  return <Panel title="This week">
      <div className="px-4 pb-3 pt-4">
        <div className="relative flex h-28 items-end gap-2 border-b border-stroke" aria-hidden="true">
          {week.map((d, i) => <div key={d.ymd} className="relative flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {d.open ? <>
                  <span className="num mb-1 text-[11px] font-semibold text-fg-muted">{d.n}</span>
                  <div className="w-full max-w-[26px] rounded-t-[4px] transition-opacity duration-150" style={{
              height: `${d.n / max * 76}%`,
              minHeight: d.n ? 4 : 0,
              background: 'var(--chart-bar)',
              opacity: hover == null || hover === i ? 1 : 0.5
            }} />
                </> : <span className="mb-1 text-[10px] text-fg-subtle">Off</span>}
              {hover === i && d.open && <div className="num absolute -top-1 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-md bg-[#101828] px-2 py-1 text-[11px] text-white shadow">
                  {fmtYmd(d.ymd, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}: {d.n}
                </div>}
            </div>)}
        </div>
        <div className="mt-1.5 flex gap-2" aria-hidden="true">
          {week.map(d => <span key={d.ymd} className={cx('flex-1 text-center text-[11px]', d.ymd === today ? 'font-semibold text-fg' : 'text-fg-subtle')}>
              {DAY_NAMES[d.dow].slice(0, 3)}
            </span>)}
        </div>
        <table className="sr-only">
          <caption>Bookings this week by day</caption>
          <tbody>
            {week.map(d => <tr key={d.ymd}>
                <th scope="row">{fmtYmd(d.ymd)}</th>
                <td>{d.open ? `${d.n} bookings` : 'Closed'}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </Panel>;
}