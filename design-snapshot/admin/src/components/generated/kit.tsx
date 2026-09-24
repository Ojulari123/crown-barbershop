// Admin UI kit. Compact dashboard sizing on desktop (36px controls, 14px text),
// automatically roomier on touch screens (pointer-coarse: 44px).

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Ban, CheckCircle2, CircleCheckBig, Clock, MoreHorizontal, UserX, X } from 'lucide-react';
import { cx } from './data';
import type { BookingStatus } from './store';
export const SITE_URL = 'https://api.magicpath.ai/v1/bold-shade-8845';
export const EASE = [0.23, 1, 0.32, 1] as const;

// ---------- buttons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';
const V: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_1px_0_rgb(0_0_0/0.08)]',
  secondary: 'bg-panel text-fg ring-1 ring-inset ring-stroke-strong hover:bg-sunken',
  ghost: 'text-fg-muted hover:bg-sunken hover:text-fg',
  danger: 'bg-panel text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50 dark:text-red-300 dark:ring-red-400/30 dark:hover:bg-red-950/40'
};
const S: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 pointer-coarse:h-10',
  md: 'h-9 px-3.5 text-[14px] gap-2 pointer-coarse:h-11'
};
const base = 'press inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40';
type BtnProps = {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: BtnProps) {
  return <button type="button" {...rest} className={cx(base, V[variant], S[size], className)}>
      {icon}
      {children}
    </button>;
}
export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...rest} className={cx(base, V[variant], S[size], className)}>
      {icon}
      {children}
    </a>;
}
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: {
  label: string;
  icon: ReactNode;
} & Omit<BtnProps, 'children'>) {
  return <button type="button" aria-label={label} title={label} {...rest} className={cx(base, V[variant], size === 'sm' ? 'h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10' : 'h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11', className)}>
      {icon}
    </button>;
}

// ---------- surfaces ----------

export function Panel({
  title,
  action,
  children,
  className,
  bodyClass
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return <section className={cx('rounded-xl border border-stroke bg-panel', className)}>
      {(title || action) && <header className="flex min-h-[48px] items-center justify-between gap-3 border-b border-stroke px-4 py-2">
          {typeof title === 'string' ? <h2 className="text-[14px] font-semibold text-fg">{title}</h2> : title}
          {action}
        </header>}
      <div className={bodyClass}>{children}</div>
    </section>;
}
export function Empty({
  icon,
  title,
  body,
  action,
  compact
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return <div className={cx('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14')}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-fg-subtle">{icon}</span>
      <p className="mt-3 text-[14px] font-semibold text-fg">{title}</p>
      {body && <p className="mt-1 max-w-[40ch] text-[13px] text-fg-subtle">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>;
}

// ---------- status ----------

export const STATUS: Record<BookingStatus, {
  label: string;
  icon: typeof Clock;
  cls: string;
  bar: string;
}> = {
  requested: {
    label: 'To confirm',
    icon: Clock,
    cls: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/25',
    bar: 'bg-amber-400'
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle2,
    cls: 'bg-accent-soft text-accent ring-accent/20',
    bar: 'bg-accent'
  },
  done: {
    label: 'Done',
    icon: CircleCheckBig,
    cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/25',
    bar: 'bg-emerald-500'
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    cls: 'bg-sunken text-fg-subtle ring-stroke',
    bar: 'bg-stroke-strong'
  },
  'no-show': {
    label: 'No-show',
    icon: UserX,
    cls: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-400/25',
    bar: 'bg-red-500'
  }
};
export function StatusBadge({
  status
}: {
  status: BookingStatus;
}) {
  const s = STATUS[status];
  const Icon = s.icon;
  return <span className={cx('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium ring-1 ring-inset', s.cls)}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      {s.label}
    </span>;
}
export function Count({
  n,
  tone = 'muted'
}: {
  n: number;
  tone?: 'muted' | 'alert';
}) {
  if (!n) return null;
  return <span className={cx('num inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold', tone === 'alert' ? 'bg-red-600 text-white' : 'bg-sunken text-fg-muted ring-1 ring-inset ring-stroke')}>
      {n}
    </span>;
}

// ---------- form controls ----------

export const inputCls = (err?: boolean, extra?: string) => cx('h-9 w-full rounded-lg bg-panel px-3 text-[14px] text-fg ring-1 ring-inset placeholder:text-fg-subtle focus:outline-none focus:ring-2 pointer-coarse:h-11', err ? 'ring-red-500 focus:ring-red-500' : 'ring-stroke-strong focus:ring-accent', extra);
export function Field({
  label,
  id,
  hint,
  error,
  children,
  className
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[12px] text-fg-subtle">{hint}</p>}
      {error && <p role="alert" className="text-[12px] font-medium text-red-600 dark:text-red-400">
          {error}
        </p>}
    </div>;
}
export function Switch({
  checked,
  onChange,
  label,
  hideLabel
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hideLabel?: boolean;
}) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={hideLabel ? label : undefined} onClick={() => onChange(!checked)} className="inline-flex min-h-[32px] items-center gap-2 text-[13px] font-medium text-fg pointer-coarse:min-h-[44px]">
      <span className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150', checked ? 'bg-accent' : 'bg-stroke-strong')}>
        <motion.span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" animate={{
        x: checked ? 16 : 0
      }} transition={{
        type: 'spring',
        duration: 0.25,
        bounce: 0
      }} />
      </span>
      {!hideLabel && label}
    </button>;
}
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label
}: {
  value: T;
  onChange: (v: T) => void;
  options: {
    id: T;
    label: string;
    count?: number;
  }[];
  label: string;
}) {
  const id = useId();
  return <div role="tablist" aria-label={label} className="inline-flex rounded-lg bg-sunken p-0.5 ring-1 ring-inset ring-stroke">
      {options.map(o => {
      const active = o.id === value;
      return <button key={o.id} role="tab" type="button" aria-selected={active} onClick={() => onChange(o.id)} className={cx('relative inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium pointer-coarse:h-10', active ? 'text-fg' : 'text-fg-muted hover:text-fg')}>
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md bg-panel shadow-[0_1px_2px_rgb(16_24_40/0.08)] ring-1 ring-stroke" transition={{
          type: 'spring',
          duration: 0.3,
          bounce: 0
        }} />}
            <span className="relative">{o.label}</span>
            {!!o.count && <span className="num relative text-[12px] text-fg-subtle">{o.count}</span>}
          </button>;
    })}
    </div>;
}

// ---------- dropdown menu (row actions) ----------

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  href?: string;
} | 'divider';
export function Menu({
  items,
  label = 'More actions'
}: {
  items: MenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus(), 10);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <IconButton label={label} size="sm" icon={<MoreHorizontal className="h-4 w-4" strokeWidth={2} />} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)} />
      <AnimatePresence>
        {open && <motion.div role="menu" initial={{
        opacity: 0,
        scale: 0.96,
        y: -4
      }} animate={{
        opacity: 1,
        scale: 1,
        y: 0
      }} exit={{
        opacity: 0,
        scale: 0.96,
        transition: {
          duration: 0.1
        }
      }} transition={{
        duration: 0.14,
        ease: EASE
      }} className="absolute right-0 top-9 z-30 min-w-[200px] origin-top-right rounded-lg border border-stroke bg-panel p-1 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.25)]">
            {items.map((it, i) => it === 'divider' ? <div key={i} className="my-1 h-px bg-stroke" /> : it.href ? <a key={i} role="menuitem" href={it.href} onClick={() => setOpen(false)} className="flex h-9 items-center gap-2 rounded-md px-2.5 text-[13px] text-fg hover:bg-sunken focus:bg-sunken focus:outline-none pointer-coarse:h-11">
                  {it.icon}
                  {it.label}
                </a> : <button key={i} type="button" role="menuitem" onClick={() => {
          setOpen(false);
          it.onSelect();
        }} className={cx('flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] hover:bg-sunken focus:bg-sunken focus:outline-none pointer-coarse:h-11', it.danger ? 'text-red-600 dark:text-red-400' : 'text-fg')}>
                  {it.icon}
                  {it.label}
                </button>)}
          </motion.div>}
      </AnimatePresence>
    </div>;
}

// ---------- drawer (right side on desktop, bottom sheet on phones) ----------

function useModal(open: boolean, onClose: () => void, panel: RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      (panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>('input,select,textarea') ?? panel.current)?.focus();
    }, 40);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', key);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', key);
      document.documentElement.style.overflow = '';
      prev?.focus?.();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useModal(open, onClose, panel);
  const hidden = reduce ? {
    opacity: 0
  } : wide ? {
    x: '100%'
  } : {
    y: '100%'
  };
  return <AnimatePresence>
      {open && <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-[#0b1020]/40" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} onClick={onClose} aria-hidden="true" />
          <motion.div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} initial={hidden} animate={{
        x: 0,
        y: 0,
        opacity: 1
      }} exit={{
        ...hidden,
        transition: {
          duration: 0.18,
          ease: EASE
        }
      }} transition={{
        type: 'spring',
        duration: 0.35,
        bounce: 0
      }} className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-2xl bg-panel shadow-2xl focus:outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:border-l md:border-stroke">
            <header className="flex items-start justify-between gap-3 border-b border-stroke px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-semibold text-fg">{title}</h2>
                {subtitle && <div className="mt-0.5 text-[13px] text-fg-subtle">{subtitle}</div>}
              </div>
              <IconButton label="Close" size="sm" icon={<X className="h-4 w-4" strokeWidth={2} />} onClick={onClose} />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
            {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-stroke bg-sunken px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
          </motion.div>
        </div>}
    </AnimatePresence>;
}
export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useModal(open, onCancel, panel);
  return <AnimatePresence>
      {open && <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
          <motion.div className="absolute inset-0 bg-[#0b1020]/45" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} onClick={onCancel} aria-hidden="true" />
          <motion.div ref={panel} role="alertdialog" aria-modal="true" aria-label={title} initial={{
        opacity: 0,
        scale: 0.97
      }} animate={{
        opacity: 1,
        scale: 1
      }} exit={{
        opacity: 0,
        scale: 0.97,
        transition: {
          duration: 0.12
        }
      }} transition={{
        duration: 0.18,
        ease: EASE
      }} className="relative w-full max-w-sm rounded-xl border border-stroke bg-panel p-5 shadow-2xl">
            <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
            <div className="mt-2 text-[14px] text-fg-muted">{body}</div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={onCancel} data-autofocus>
                Cancel
              </Button>
              <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>}
    </AnimatePresence>;
}

// ---------- toasts ----------

type Toast = {
  id: number;
  text: string;
  tone?: 'ok' | 'error';
  undo?: () => void;
};
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({
  children
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems(xs => [...xs.slice(-2), {
      ...t,
      id
    }]);
    window.setTimeout(() => setItems(xs => xs.filter(x => x.id !== id)), t.undo ? 6000 : 3500);
  }, []);
  return <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col items-center gap-2 md:bottom-5 md:left-auto md:right-5 md:items-end">
        <AnimatePresence initial={false}>
          {items.map(t => <motion.div key={t.id} layout initial={{
          opacity: 0,
          y: 12,
          scale: 0.98
        }} animate={{
          opacity: 1,
          y: 0,
          scale: 1
        }} exit={{
          opacity: 0,
          transition: {
            duration: 0.12
          }
        }} transition={{
          type: 'spring',
          duration: 0.3,
          bounce: 0
        }} className={cx('pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-[13px] shadow-[0_12px_32px_-8px_rgb(16_24_40/0.45)]', t.tone === 'error' ? 'bg-red-700 text-white' : 'bg-[#101828] text-white dark:bg-[#e7eaf0] dark:text-[#101828]')}>
              <span>{t.text}</span>
              {t.undo && <button type="button" onClick={() => {
            t.undo?.();
            setItems(xs => xs.filter(x => x.id !== t.id));
          }} className="shrink-0 rounded px-2 py-1 font-semibold underline underline-offset-2 hover:bg-white/10">
                  Undo
                </button>}
            </motion.div>)}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>;
}

// ---------- helpers ----------

export function timeAgo(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d` : new Date(ts).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric'
  });
}
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const smsHref = (phone: string) => `sms:${phone.replace(/[^\d+]/g, '')}`;
export function Avatar({
  name,
  size = 'md'
}: {
  name: string;
  size?: 'sm' | 'md';
}) {
  const palette = ['#4f6bd8', '#0e7490', '#15803d', '#7e22ce', '#c2410c', '#b91c1c'];
  const n = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', size === 'sm' ? 'h-7 w-7 text-[12px]' : 'h-9 w-9 text-[13px]')} style={{
    background: palette[n % palette.length]
  }} aria-hidden="true">
      {name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
    </span>;
}

// ---------- page header ----------

export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 tabIndex={-1} data-admin-title className="font-display text-[30px] font-medium leading-tight tracking-[-0.01em] text-fg focus:outline-none md:text-[34px]">
          {title}
        </h1>
        {description && <p className="mt-0.5 text-[13px] text-fg-subtle">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>;
}