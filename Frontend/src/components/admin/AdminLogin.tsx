'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/store';
import { Login } from './Login';

// Where to go after signing in: back to the screen that sent you here, else Today.
function target() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && /^\/admin\/[a-z]+$/.test(next) ? next : '/admin/today';
}

export function AdminLogin() {
  const router = useRouter();
  useEffect(() => {
    // Already signed in (for example a second tab): skip the form. Only ask the server when
    // the non-secret hint cookie says there may be a session (no 401 noise otherwise).
    if (!document.cookie.split('; ').some(c => c.startsWith('crown_signed_in='))) return;
    void getSession().then(s => {
      if (s) router.replace(target());
    });
  }, [router]);
  return <Login onIn={() => router.replace(target())} />;
}
