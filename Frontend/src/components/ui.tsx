'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';
import { ArrowRight } from 'lucide-react';
import { LOGO_SRC, cx } from '@/lib/data';
export const EASE = [0.23, 1, 0.32, 1] as const;

// Simple geometric crown. Placeholder until the shop's own mascot logo is supplied.
export function CrownMark({
  className = 'h-6 w-6'
}: {
  className?: string;
}) {
  return <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <path d="M4 24 L6 9 L12 16 L16 6 L20 16 L26 9 L28 24 Z" fill="currentColor" />
      <rect x="4" y="25.5" width="24" height="3" rx="1" fill="currentColor" />
    </svg>;
}

export function Logo({
  className = 'h-10 w-auto',
  alt = ''
}: {
  className?: string;
  alt?: string;
}) {
  return <img src={LOGO_SRC} alt={alt} width={430} height={458} className={cx('select-none', className)} draggable={false} />;
}

// Printed-sign ornament: rule, crown, rule. Sits under section headings.
export function Ornament({
  className,
  tone = 'text-cobalt'
}: {
  className?: string;
  tone?: string;
}) {
  return <div className={cx('flex items-center gap-3', tone, className)} aria-hidden="true">
      <span className="h-px w-12 bg-current opacity-50" />
      <CrownMark className="h-4 w-4" />
      <span className="h-px w-12 bg-current opacity-50" />
    </div>;
}

// Gentle fade-up. Kept short and small so it never gets in the way of reading.
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div'
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'section';
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return <Comp key={reduce ? 'still' : 'motion'} className={className} initial={reduce ? {
    opacity: 1
  } : {
    opacity: 0,
    y: 14
  }} whileInView={{
    opacity: 1,
    y: 0
  }} viewport={{
    once: true,
    amount: 0.15
  }} transition={{
    duration: 0.6,
    delay,
    ease: EASE
  }}>
      
      {children}
    </Comp>;
}
type PillProps = {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'light' | 'outlineLight';
  icon?: ReactNode;
  className?: string;
  external?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

// Classic shop button: rounded rectangle, bold label, pressed-enamel bottom edge.
export function Pill({
  href,
  onClick,
  children,
  variant = 'primary',
  icon,
  className,
  external,
  type = 'button',
  disabled
}: PillProps) {
  const base = 'press group inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[10px] px-6 whitespace-nowrap text-[18px] font-semibold disabled:opacity-50 disabled:pointer-events-none';
  const styles = {
    primary: 'bg-cobalt text-on-cobalt shadow-[inset_0_-3px_0_rgb(0_0_0/0.22),0_8px_20px_-10px_rgb(20_33_92/0.6)] hover:bg-deep dark:hover:bg-surface-2 dark:hover:text-ink',
    ghost: 'bg-surface text-ink ring-2 ring-inset ring-ink/25 hover:ring-cobalt hover:bg-surface-2',
    light: 'bg-on-deep text-deep shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)] hover:bg-white',
    outlineLight: 'text-on-deep ring-2 ring-inset ring-white/30 hover:bg-white/10 hover:ring-white/60'
  }[variant];
  const trailing = icon ?? (variant !== 'ghost' && variant !== 'outlineLight' ? <ArrowRight className="h-5 w-5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5" strokeWidth={2} /> : null);
  const inner = <>
      <span>{children}</span>
      {trailing}
    </>;
  if (href) {
    return <a href={href} onClick={onClick} className={cx(base, styles, className)} {...external ? {
      target: '_blank',
      rel: 'noreferrer'
    } : {}}>
        
        {inner}
      </a>;
  }
  return <button type={type} onClick={onClick} disabled={disabled} className={cx(base, styles, className)}>
      {inner}
    </button>;
}

// One heading component so each page gets exactly one h1 (focused on page change).
export function Heading({
  level = 'h2',
  className,
  children
}: {
  level?: 'h1' | 'h2';
  className?: string;
  children: ReactNode;
}) {
  const Tag = level;
  return <Tag className={cx('focus:outline-none', className)} tabIndex={level === 'h1' ? -1 : undefined} data-page-title={level === 'h1' ? '' : undefined}>
      {children}
    </Tag>;
}

// Top of every inner page: breadcrumb on the powder wall, then a strip of the shop floor.
export function PageBand({
  label
}: {
  label: string;
}) {
  return <div className="bg-surface-2">
      <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-5 pb-6 pt-8 md:px-8">
        <ol className="flex items-center gap-2 text-[16px] text-ink-soft">
          <li>
            <a href="/" className="font-medium underline decoration-ink/25 underline-offset-4 hover:text-ink hover:decoration-cobalt">
              Home
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-semibold text-ink">
            {label}
          </li>
        </ol>
      </nav>
      <div className="checker-sm h-7 opacity-90 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden="true" />
    </div>;
}