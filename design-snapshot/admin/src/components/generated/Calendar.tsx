// Month calendar used for every date choice (booking, admin bookings, notices, days off).
// Accessible grid pattern: arrow keys move by day/week, PageUp/PageDown by month, Home/End by week.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx, torontoNow } from './data';
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');
export const toYmd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return {
    y,
    m: m - 1,
    d
  };
};
const addDays = (ymd: string, n: number) => {
  const {
    y,
    m,
    d
  } = parse(ymd);
  const t = new Date(Date.UTC(y, m, d + n, 12));
  return toYmd(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};
const addMonths = (y: number, m: number, n: number) => {
  const t = new Date(Date.UTC(y, m + n, 1, 12));
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth()
  };
};
export type DayState = 'open' | 'closed' | 'full' | 'off' | 'normal';
type Theme = 'site' | 'admin';
const T: Record<Theme, Record<string, string>> = {
  site: {
    wrap: 'text-ink',
    title: 'font-display text-[24px] text-ink',
    nav: 'h-11 w-11 rounded-full text-ink ring-1 ring-inset ring-line hover:bg-surface-2 disabled:opacity-30',
    head: 'font-sign text-[14px] font-semibold uppercase tracking-[0.08em] text-ink-soft',
    headW: 'w-11 sm:w-12',
    cell: 'h-11 w-11 text-[17px] sm:h-12 sm:w-12',
    base: 'rounded-full font-medium tabular-nums',
    enabled: 'text-ink hover:bg-surface-2',
    selected: 'bg-cobalt text-on-cobalt hover:bg-cobalt shadow-[0_6px_16px_-6px_rgb(35_68_168/0.6)]',
    disabled: 'text-ink-soft/35 cursor-not-allowed',
    today: 'ring-2 ring-inset ring-cobalt/40',
    off: 'bg-red-50 text-red-700 line-through dark:bg-red-950/30 dark:text-red-300',
    dot: 'bg-cobalt',
    dotSel: 'bg-on-cobalt',
    legend: 'text-[15px] text-ink-soft'
  },
  admin: {
    wrap: 'text-fg',
    title: 'text-[14px] font-semibold text-fg',
    nav: 'h-8 w-8 rounded-lg text-fg-muted hover:bg-sunken hover:text-fg disabled:opacity-30 pointer-coarse:h-10 pointer-coarse:w-10',
    head: 'text-[11px] font-medium text-fg-subtle',
    headW: 'w-9 pointer-coarse:w-10',
    cell: 'h-9 w-9 text-[13px] pointer-coarse:h-10 pointer-coarse:w-10',
    base: 'rounded-lg font-medium tabular-nums',
    enabled: 'text-fg hover:bg-sunken',
    selected: 'bg-accent text-accent-fg hover:bg-accent-hover',
    disabled: 'text-fg-subtle/40 cursor-not-allowed',
    today: 'ring-1 ring-inset ring-accent/50',
    off: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-400/30',
    dot: 'bg-accent',
    dotSel: 'bg-accent-fg',
    legend: 'text-[12px] text-fg-subtle'
  }
};
export function Calendar({
  value,
  onChange,
  min,
  max,
  stateOf,
  theme = 'site',
  label = 'Choose a date',
  legend,
  multi
}: {
  value: string | null | string[];
  onChange: (ymd: string) => void;
  min?: string;
  max?: string;
  /** open = has free times (shows a dot), full/closed = not selectable, off = marked day off (still selectable in multi mode) */
  stateOf?: (ymd: string) => DayState;
  theme?: Theme;
  label?: string;
  legend?: boolean;
  /** multi-select (days off): value is an array, clicking toggles */
  multi?: boolean;
}) {
  const t = T[theme];
  const reduce = useReducedMotion();
  const today = torontoNow().ymd;
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const start = parse(!multi && selected[0] || (min && min > today ? min : today));
  const [view, setView] = useState({
    y: start.y,
    m: start.m
  });
  const [focus, setFocus] = useState<string>(!multi && selected[0] || (min && min > today ? min : today));
  const [dir, setDir] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const hasFocus = useRef(false);

  // keep the visible month in step with an externally chosen date
  useEffect(() => {
    if (!multi && typeof value === 'string' && value) {
      const p = parse(value);
      setView(v => v.y === p.y && v.m === p.m ? v : {
        y: p.y,
        m: p.m
      });
      setFocus(value);
    }
  }, [value, multi]);
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m, 1, 12)).getUTCDay();
    const days = new Date(Date.UTC(view.y, view.m + 1, 0, 12)).getUTCDate();
    const out: (string | null)[] = Array.from({
      length: first
    }, () => null);
    for (let d = 1; d <= days; d++) out.push(toYmd(view.y, view.m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);
  const monthName = new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(view.y, view.m, 1, 12)));
  const outOfRange = (ymd: string) => min && ymd < min || max && ymd > max;
  const state = (ymd: string): DayState => outOfRange(ymd) ? 'closed' : stateOf?.(ymd) ?? 'normal';
  const selectable = (ymd: string) => {
    const s = state(ymd);
    return multi ? !outOfRange(ymd) : s !== 'closed' && s !== 'full' && s !== 'off';
  };
  const prevDisabled = !!min && toYmd(view.y, view.m, 1) <= min;
  const nextDisabled = !!max && toYmd(addMonths(view.y, view.m, 1).y, addMonths(view.y, view.m, 1).m, 1) > max;
  const shift = (n: number) => {
    setDir(n);
    setView(v => addMonths(v.y, v.m, n));
  };
  function moveFocus(to: string) {
    if (min && to < min || max && to > max) return;
    setFocus(to);
    const p = parse(to);
    if (p.y !== view.y || p.m !== view.m) {
      setDir(to > focus ? 1 : -1);
      setView({
        y: p.y,
        m: p.m
      });
    }
  }
  function onKey(e: KeyboardEvent) {
    const map: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7
    };
    if (map[e.key] != null) {
      e.preventDefault();
      moveFocus(addDays(focus, map[e.key]));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const p = parse(focus);
      const n = addMonths(p.y, p.m, e.key === 'PageUp' ? -1 : 1);
      const last = new Date(Date.UTC(n.y, n.m + 1, 0, 12)).getUTCDate();
      moveFocus(toYmd(n.y, n.m, Math.min(p.d, last)));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const dow = new Date(Date.UTC(parse(focus).y, parse(focus).m, parse(focus).d, 12)).getUTCDay();
      moveFocus(addDays(focus, e.key === 'Home' ? -dow : 6 - dow));
    } else if ((e.key === 'Enter' || e.key === ' ') && selectable(focus)) {
      e.preventDefault();
      onChange(focus);
    }
  }

  // move real DOM focus with the roving tabindex, only once the user is inside the grid
  useEffect(() => {
    if (hasFocus.current) grid.current?.querySelector<HTMLElement>(`[data-ymd="${focus}"]`)?.focus();
  }, [focus, view]);
  const fmtLong = (ymd: string) => new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(parse(ymd).y, parse(ymd).m, parse(ymd).d, 12)));
  return <div className={cx('w-max max-w-full select-none', t.wrap)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className={t.title} aria-live="polite">
          {monthName}
        </p>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => shift(-1)} disabled={prevDisabled} aria-label="Previous month" className={cx('press flex items-center justify-center', t.nav)}>
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => shift(1)} disabled={nextDisabled} aria-label="Next month" className={cx('press flex items-center justify-center', t.nav)}>
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={`${label}, ${monthName}`} onKeyDown={onKey} onFocus={() => hasFocus.current = true} onBlur={() => hasFocus.current = false} ref={grid} className="overflow-hidden">
        <div role="row" className="grid grid-cols-7">
          {WEEK.map(w => <span key={w} role="columnheader" aria-label={w} className={cx('flex items-center justify-center pb-1.5', t.headW, t.head)}>
              {theme === 'site' ? w.slice(0, 2) : w.slice(0, 1)}
            </span>)}
        </div>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div role="rowgroup" key={`${view.y}-${view.m}`} custom={dir} initial={reduce ? {
          opacity: 0
        } : {
          opacity: 0,
          x: dir * 24
        }} animate={{
          opacity: 1,
          x: 0
        }} exit={reduce ? {
          opacity: 0
        } : {
          opacity: 0,
          x: dir * -24,
          transition: {
            duration: 0.12
          }
        }} transition={{
          duration: 0.22,
          ease: [0.23, 1, 0.32, 1]
        }}>
            {Array.from({
            length: cells.length / 7
          }, (_, r) => <div role="row" key={r} className="grid grid-cols-7 gap-y-1">
                {cells.slice(r * 7, r * 7 + 7).map((ymd, i) => {
              if (!ymd) return <span key={i} role="gridcell" className={t.cell} />;
              const s = state(ymd);
              const isSel = selected.includes(ymd);
              const can = selectable(ymd);
              const off = s === 'off';
              return <span key={ymd} role="gridcell" className="flex items-center justify-center">
                      <button type="button" data-ymd={ymd} tabIndex={ymd === focus ? 0 : -1} aria-selected={isSel} aria-disabled={!can || undefined} aria-label={`${fmtLong(ymd)}${ymd === today ? ', today' : ''}${off ? ', day off' : s === 'closed' ? ', closed' : s === 'full' ? ', fully booked' : s === 'open' ? ', times available' : ''}`} onClick={() => can && onChange(ymd)} className={cx('relative flex items-center justify-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1', theme === 'site' ? 'focus-visible:ring-cobalt' : 'focus-visible:ring-accent', t.cell, t.base, isSel ? off && multi ? t.off : t.selected : off ? t.off : can ? t.enabled : t.disabled, ymd === today && !isSel && t.today)}>
                        {parse(ymd).d}
                        {s === 'open' && <span className={cx('absolute bottom-1 h-1 w-1 rounded-full', isSel ? t.dotSel : t.dot)} aria-hidden="true" />}
                      </button>
                    </span>;
            })}
              </div>)}
          </motion.div>
        </AnimatePresence>
      </div>

      {legend && <div className={cx('mt-3 flex flex-wrap items-center gap-x-4 gap-y-1', t.legend)}>
          <span className="inline-flex items-center gap-1.5">
            <span className={cx('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden="true" /> Times available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-current opacity-20" aria-hidden="true" /> Closed or full
          </span>
        </div>}
    </div>;
}
export const calendarDate = {
  addDays,
  parse
};