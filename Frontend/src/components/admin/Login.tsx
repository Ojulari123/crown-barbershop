'use client';

import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { Logo } from '@/components/ui';
import { DEMO_MODE, signIn, type Session } from '@/lib/store';
import { Button, Field, SITE_URL, inputCls } from './kit';
export type { Session };

// The public demo account seeded by `seed.py --demo`. Shown only when NEXT_PUBLIC_DEMO_MODE=1
// (the env check is inlined at build time, so other builds do not ship these strings);
// sign-in itself is checked by the server (POST /api/auth/login, httpOnly cookies).
export const DEMO_ACCOUNT = process.env.NEXT_PUBLIC_DEMO_MODE === '1' ? {
  email: 'owner@crownbarbershop.ca',
  password: 'crown2026',
  name: 'Crown owner'
} : {
  email: '',
  password: '',
  name: ''
};
export function Login({
  onIn
}: {
  onIn: (s: Session, remember: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter the email address for this account.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (next.email) return document.getElementById('login-email')?.focus();
    if (next.password) return document.getElementById('login-password')?.focus();
    setBusy(true);
    const session = await signIn(email, password, remember);
    setBusy(false);
    if (!session) {
      setErrors({
        form: 'That email and password do not match. Check both and try again.'
      });
      document.getElementById('login-password')?.focus();
      return;
    }
    onIn(session, remember);
  }
  return <div className="admin grid min-h-[100dvh] w-full bg-canvas text-fg lg:grid-cols-[minmax(420px,1fr)_1.1fr]">
      {/* brand side */}
      <aside className="relative hidden overflow-hidden bg-[#14215c] p-12 text-[#e6edf9] lg:flex lg:flex-col lg:justify-between">
        <div className="checker-sm pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-25 [mask-image:linear-gradient(to_top,black,transparent)]" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <Logo className="h-11 w-auto" />
          <span className="text-[15px] font-semibold">Crown Barber Shop</span>
        </div>
        <div className="relative">
          <Logo className="h-44 w-auto" />
          <p className="mt-8 font-display text-[40px] leading-[1.1]">Everything for the shop, in one place.</p>
          <p className="mt-3 max-w-[40ch] text-[15px] text-[#e6edf9]/75">Bookings, messages from the website, photos of your cuts, prices and hours.</p>
        </div>
        <p className="relative text-[13px] text-[#e6edf9]/60">219 Silvercreek Pkwy N, Guelph</p>
      </aside>

      {/* form side */}
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="h-11 w-auto" />
            <span className="text-[15px] font-semibold">Crown Barber Shop</span>
          </div>
          <h1 className="text-[24px] font-semibold tracking-[-0.01em]">Sign in to the admin</h1>
          <p className="mt-1 text-[14px] text-fg-subtle">Use the email and password for the shop account.</p>

          <form onSubmit={submit} noValidate className="mt-7 grid gap-4">
            <Field label="Email" id="login-email" error={errors.email}>
              <input id="login-email" name="email" type="email" inputMode="email" autoComplete="username" spellCheck={false} autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!errors.email} className={inputCls(!!errors.email)} />
            </Field>
            <Field label="Password" id="login-password" error={errors.password}>
              <div className="relative">
                <input id="login-password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} aria-invalid={!!errors.password || !!errors.form} className={inputCls(!!errors.password || !!errors.form, 'pr-11')} />
                <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute right-1 top-1/2 flex h-7 w-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-sunken hover:text-fg pointer-coarse:h-9">
                  {show ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-fg">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="h-4 w-4 rounded border-stroke-strong accent-[var(--a-accent)]" />
                Keep me signed in
              </label>
              <button type="button" onClick={() => setForgot(v => !v)} aria-expanded={forgot} className="text-[13px] font-medium text-accent hover:underline">
                Forgot password?
              </button>
            </div>

            <AnimatePresence initial={false}>
              {forgot && DEMO_MODE && <motion.p initial={{
              opacity: 0,
              height: 0
            }} animate={{
              opacity: 1,
              height: 'auto'
            }} exit={{
              opacity: 0,
              height: 0
            }} className="overflow-hidden rounded-lg bg-sunken px-3 py-2.5 text-[13px] text-fg-muted ring-1 ring-inset ring-stroke">
                  In the live version this sends a reset link to your email. For this demo, use the account below.
                </motion.p>}
            </AnimatePresence>

            {errors.form && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-400/30">
                {errors.form}
              </p>}

            <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full" icon={busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Lock className="h-4 w-4" strokeWidth={2} />}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {DEMO_MODE && <div className="mt-6 rounded-lg border border-dashed border-stroke-strong px-3.5 py-3 text-[13px] text-fg-muted">
            <p className="font-medium text-fg">Demo account</p>
            <p className="mt-1">
              Email <span className="num font-medium text-fg">{DEMO_ACCOUNT.email}</span>
              <br />
              Password <span className="num font-medium text-fg">{DEMO_ACCOUNT.password}</span>
            </p>
          </div>}

          <a href={SITE_URL} className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to the website
          </a>
        </div>
      </main>
    </div>;
}