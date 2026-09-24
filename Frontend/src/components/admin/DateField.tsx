'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, X } from 'lucide-react';
import { cx } from '@/lib/data';
import { fmtYmd } from '@/lib/store';
import { Calendar, type DayState } from '@/components/Calendar';
import { EASE } from './kit';

// Input-looking button that opens the month calendar in a popover.
export function DateField({
  id,
  value,
  onChange,
  min,
  max,
  stateOf,
  placeholder = 'Pick a date',
  clearable,
  invalid
}: {
  id: string;
  value: string | null;
  onChange: (ymd: string | null) => void;
  min?: string;
  max?: string;
  stateOf?: (ymd: string) => DayState;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key, true);
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[role=grid] button[tabindex="0"]')?.focus(), 30);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key, true);
    };
  }, [open]);
  return <div ref={ref} className="relative">
      <button ref={btn} id={id} type="button" aria-haspopup="dialog" aria-expanded={open} aria-invalid={invalid || undefined} onClick={() => setOpen(v => !v)} className={cx('flex h-9 w-full items-center gap-2 rounded-lg bg-panel px-3 text-left text-[14px] ring-1 ring-inset focus:outline-none focus:ring-2 pointer-coarse:h-11', invalid ? 'ring-red-500 focus:ring-red-500' : 'ring-stroke-strong focus:ring-accent')}>
        <CalendarDays className="h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.75} aria-hidden="true" />
        <span className={cx('flex-1 truncate', value ? 'text-fg' : 'text-fg-subtle')}>{value ? fmtYmd(value, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : placeholder}</span>
      </button>
      {clearable && value && <button type="button" aria-label="Clear date" onClick={() => onChange(null)} className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-sunken hover:text-fg">
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>}
      <AnimatePresence>
        {open && <motion.div role="dialog" aria-label="Choose a date" initial={{
        opacity: 0,
        y: -4,
        scale: 0.98
      }} animate={{
        opacity: 1,
        y: 0,
        scale: 1
      }} exit={{
        opacity: 0,
        scale: 0.98,
        transition: {
          duration: 0.1
        }
      }} transition={{
        duration: 0.16,
        ease: EASE
      }} className="absolute left-0 top-11 z-40 origin-top-left rounded-xl border border-stroke bg-panel p-3 shadow-[0_16px_40px_-10px_rgb(16_24_40/0.3)] pointer-coarse:top-12">
            <Calendar theme="admin" value={value} min={min} max={max} stateOf={stateOf} onChange={d => {
          onChange(d);
          setOpen(false);
          btn.current?.focus();
        }} />
          </motion.div>}
      </AnimatePresence>
    </div>;
}