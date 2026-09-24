'use client';

import { useEffect, useState } from 'react';
import { CalendarOff, Info, Megaphone } from 'lucide-react';
import { DAY_NAMES, cx, fmtTime, torontoNow } from '@/lib/data';
import { activeNotice, fmtYmd, setSlice, useCrown, ymdPlus, type Hours } from '@/lib/store';
import { Calendar } from '@/components/Calendar';
import { DateField } from './DateField';
import { Button, Field, PageHeader, Panel, Switch, inputCls, useToast } from './kit';
import { SaveBar, useDirtyGuard } from './PricesAdmin';
type Day = {
  open: boolean;
  start: number;
  end: number;
  lunch: boolean;
  ls: number;
  le: number;
};
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIMES = Array.from({
  length: (22 - 6) * 4 + 1
}, (_, i) => 360 + i * 15);
const toDraft = (h: Hours): Day[] => Array.from({
  length: 7
}, (_, d) => {
  const r = h[d] ?? [];
  if (!r.length) return {
    open: false,
    start: 600,
    end: 1080,
    lunch: false,
    ls: 840,
    le: 900
  };
  return {
    open: true,
    start: r[0][0],
    end: r[r.length - 1][1],
    lunch: r.length > 1,
    ls: r.length > 1 ? r[0][1] : 840,
    le: r.length > 1 ? r[1][0] : 900
  };
});
const toHours = (d: Day[]): Hours => d.map(x => !x.open ? [] : x.lunch ? [[x.start, x.ls], [x.le, x.end]] : [[x.start, x.end]]) as Hours;
function T({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} className={inputCls(false, 'num h-8 w-[108px] text-[13px] pointer-coarse:h-10')} value={value} onChange={e => onChange(Number(e.target.value))}>
        {TIMES.map(m => <option key={m} value={m}>
            {fmtTime(m)}
          </option>)}
      </select>
    </>;
}
export function HoursAdmin({
  onDirty
}: {
  onDirty: (d: boolean) => void;
}) {
  const crown = useCrown();
  const toast = useToast();
  const saved = toDraft(crown.hours);
  const [days, setDays] = useState<Day[]>(saved);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const dirty = JSON.stringify(toHours(days)) !== JSON.stringify(crown.hours);
  useDirtyGuard(dirty);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const set = (d: number, p: Partial<Day>) => setDays(xs => xs.map((x, i) => i === d ? {
    ...x,
    ...p
  } : x));
  function save() {
    const e: Record<number, string> = {};
    days.forEach((x, d) => {
      if (!x.open) return;
      if (x.end <= x.start) e[d] = 'Closing must be after opening';else if (x.lunch && !(x.start < x.ls && x.ls < x.le && x.le < x.end)) e[d] = 'Lunch must fit inside open hours';
    });
    setErrors(e);
    if (Object.keys(e).length) return toast({
      text: 'Fix the highlighted days first.',
      tone: 'error'
    });
    setSlice('hours', toHours(days));
    toast({
      text: 'Hours saved · website and booking times updated'
    });
  }
  return <>
      <PageHeader title="Hours & notices" description="Opening hours drive the website and which times customers can book." />
      {/* grid-cols-1 (minmax(0,1fr)) and a relative scroller keep the 620px table from widening phones */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Weekly hours" bodyClass="relative overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[13px]">
            <thead className="bg-sunken text-[12px] text-fg-subtle">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Day</th>
                <th scope="col" className="px-2 py-2 font-medium">Open</th>
                <th scope="col" className="px-2 py-2 font-medium">Hours</th>
                <th scope="col" className="px-2 py-2 font-medium">Lunch break</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {ORDER.map(d => {
              const x = days[d];
              return <tr key={d} className={cx(!x.open && 'bg-sunken/60', errors[d] && 'bg-red-50/60 dark:bg-red-950/20')}>
                    <th scope="row" className="px-4 py-2 font-medium text-fg">
                      {DAY_NAMES[d]}
                      {errors[d] && <span role="alert" className="block text-[11px] font-medium text-red-600">{errors[d]}</span>}
                    </th>
                    <td className="px-2 py-2">
                      <Switch hideLabel label={`${DAY_NAMES[d]} open`} checked={x.open} onChange={v => set(d, {
                    open: v
                  })} />
                    </td>
                    <td className="px-2 py-2">
                      {x.open ? <span className="flex items-center gap-1.5">
                          <T id={`h${d}s`} label={`${DAY_NAMES[d]} opens`} value={x.start} onChange={v => set(d, {
                      start: v
                    })} />
                          <span className="text-fg-subtle">to</span>
                          <T id={`h${d}e`} label={`${DAY_NAMES[d]} closes`} value={x.end} onChange={v => set(d, {
                      end: v
                    })} />
                        </span> : <span className="text-fg-subtle">Closed</span>}
                    </td>
                    <td className="px-2 py-2">
                      {x.open && (x.lunch ? <span className="flex items-center gap-1.5">
                            <T id={`h${d}ls`} label={`${DAY_NAMES[d]} lunch starts`} value={x.ls} onChange={v => set(d, {
                      ls: v
                    })} />
                            <span className="text-fg-subtle">to</span>
                            <T id={`h${d}le`} label={`${DAY_NAMES[d]} lunch ends`} value={x.le} onChange={v => set(d, {
                      le: v
                    })} />
                            <Button size="sm" variant="ghost" onClick={() => set(d, {
                      lunch: false
                    })}>
                              Remove
                            </Button>
                          </span> : <Button size="sm" variant="ghost" onClick={() => set(d, {
                    lunch: true
                  })}>
                            + Add lunch
                          </Button>)}
                    </td>
                  </tr>;
            })}
            </tbody>
          </table>
        </Panel>
        <div className="grid content-start gap-4">
          <DaysOffPanel />
          <NoticePanel />
        </div>
      </div>
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => {
      setDays(saved);
      setErrors({});
    }} label="Unsaved hour changes" />
    </>;
}
function NoticePanel() {
  const crown = useCrown();
  const toast = useToast();
  const live = activeNotice(crown);
  const today = torontoNow().ymd;
  const [text, setText] = useState(crown.notice?.text ?? '');
  const [until, setUntil] = useState(crown.notice?.until ?? '');
  const [error, setError] = useState('');
  function post() {
    if (text.trim().length < 5) {
      setError('Write a short message first.');
      document.getElementById('notice-text')?.focus();
      return;
    }
    setError('');
    setSlice('notice', {
      text: text.trim(),
      until: until || null
    });
    toast({
      text: 'Notice is live on the website'
    });
  }
  function remove() {
    const before = crown.notice;
    setSlice('notice', null);
    setText('');
    setUntil('');
    toast({
      text: 'Notice removed',
      undo: () => setSlice('notice', before)
    });
  }
  return <Panel title={<div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-fg">Website notice</h2>
          {live && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/25">Live</span>}
        </div>} bodyClass="grid gap-3 p-4">
      <p className="text-[12px] text-fg-subtle">A bar across the top of every page. Use it for holidays, sick days or a late start.</p>
      <Field label="Message" id="notice-text" error={error}>
        <input id="notice-text" maxLength={140} className={inputCls(!!error)} value={text} onChange={e => setText(e.target.value)} placeholder="Closed Saturday for Thanksgiving" />
      </Field>
      <div className="flex items-end gap-2">
        <Field label="Remove after (optional)" id="notice-until" className="flex-1">
          <DateField id="notice-until" value={until || null} min={today} max={ymdPlus(365)} clearable placeholder="Keep it up until removed" onChange={v => setUntil(v ?? '')} />
        </Field>
        <Button variant="secondary" onClick={() => {
        setText(`Closed today, ${fmtYmd(today, {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })}. Sorry for any trouble.`);
        setUntil(today);
      }}>
          Closed today
        </Button>
      </div>
      {text.trim() && <div>
          <p className="mb-1 text-[12px] font-medium text-fg-subtle">Preview</p>
          <div className="flex items-center justify-center gap-2 rounded-lg bg-[#2344a8] px-3 py-2 text-center text-[13px] font-medium text-white">
            <Info className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> {text.trim()}
          </div>
        </div>}
      <div className="flex gap-2 pt-1">
        <Button variant="primary" onClick={post}>
          {live ? 'Update notice' : 'Post notice'}
        </Button>
        {crown.notice && <Button variant="ghost" onClick={remove}>
            Remove
          </Button>}
      </div>
    </Panel>;
}

// Days off: tap dates on the calendar to close them. Booking on the website skips them.
function DaysOffPanel() {
  const crown = useCrown();
  const toast = useToast();
  const today = torontoNow().ymd;
  const off = (crown.closures ?? []).filter(d => d >= today).sort();
  const booked = (ymd: string) => crown.bookings.filter(b => b.date === ymd && (b.status === 'confirmed' || b.status === 'requested')).length;
  function toggle(ymd: string) {
    const isOff = off.includes(ymd);
    setSlice('closures', xs => isOff ? xs.filter(x => x !== ymd) : [...xs, ymd]);
    const n = booked(ymd);
    toast({
      text: isOff ? `${fmtYmd(ymd, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })} is open again` : `${fmtYmd(ymd, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })} marked as a day off${n ? ` · ${n} booking${n === 1 ? '' : 's'} to call` : ''}`,
      undo: () => setSlice('closures', xs => isOff ? [...xs, ymd] : xs.filter(x => x !== ymd))
    });
  }
  return <Panel title={<div className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-fg">Days off</h2>
          {off.length > 0 && <span className="num text-[12px] text-fg-subtle">{off.length} upcoming</span>}
        </div>} bodyClass="grid gap-4 p-4 sm:grid-cols-[auto_1fr] xl:grid-cols-1 2xl:grid-cols-[auto_1fr]">
      <Calendar theme="admin" multi value={off} min={today} max={ymdPlus(365)} stateOf={d => off.includes(d) ? 'off' : 'normal'} onChange={toggle} label="Tap dates to mark days off" />
      <div className="min-w-0">
        <p className="text-[12px] text-fg-subtle">Tap a date to close the shop that day. Tap it again to reopen. Customers cannot book closed days.</p>
        {off.length === 0 ? <p className="mt-3 text-[13px] text-fg-muted">No days off planned.</p> : <ul className="mt-3 divide-y divide-stroke rounded-lg border border-stroke">
            {off.map(d => <li key={d} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                <span className="text-fg">
                  {fmtYmd(d, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
                  {booked(d) > 0 && <span className="ml-2 text-[12px] font-medium text-amber-700 dark:text-amber-300">{booked(d)} booked</span>}
                </span>
                <Button size="sm" variant="ghost" onClick={() => toggle(d)}>
                  Reopen
                </Button>
              </li>)}
          </ul>}
      </div>
    </Panel>;
}