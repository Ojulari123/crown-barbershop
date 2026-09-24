'use client';

// Hydration-safe stand-in for framer-motion's useReducedMotion().
// framer reads matchMedia during the very first client render, so a server-rendered page
// hydrates with different motion props than the server used (a hydration mismatch for
// anyone with "reduce motion" on). This returns false for the server render and for
// hydration, then the real preference right after.

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(fn: () => void) {
  const m = window.matchMedia(QUERY);
  m.addEventListener('change', fn);
  return () => m.removeEventListener('change', fn);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
