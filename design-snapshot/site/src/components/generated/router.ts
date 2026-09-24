// Tiny hash router: pages live at #/prices, #/book and so on.
// Hash URLs work on any static host with no server setup, and the back button,
// bookmarks and shared links all behave. Plain anchors like #main are left alone.

import { useSyncExternalStore } from 'react';

export type Route = '/' | '/prices' | '/book' | '/gallery' | '/about' | '/visit' | '/not-found';

export const PAGES: { path: Exclude<Route, '/not-found'>; label: string; title: string }[] = [
  { path: '/', label: 'Home', title: 'Crown Barber Shop | Old-school cuts in Guelph' },
  { path: '/about', label: 'About', title: 'About the shop | Crown Barber Shop, Guelph' },
  { path: '/prices', label: 'Prices', title: 'Prices | Crown Barber Shop, Guelph' },
  { path: '/gallery', label: 'Gallery', title: 'Recent cuts | Crown Barber Shop, Guelph' },
  { path: '/visit', label: 'Hours & map', title: 'Hours, map and questions | Crown Barber Shop, Guelph' },
  { path: '/book', label: 'Book', title: 'Reserve a chair | Crown Barber Shop, Guelph' },
];

const KNOWN = new Set<string>(PAGES.map((p) => p.path));

function parse(hash: string): Route | null {
  if (hash === '' || hash === '#' || hash === '#/') return '/';
  if (!hash.startsWith('#/')) return null; // in-page anchor: keep the current page
  const path = hash.slice(1).split('?')[0].replace(/\/+$/, '') || '/';
  return (KNOWN.has(path) ? path : '/not-found') as Route;
}

let current: Route = typeof window === 'undefined' ? '/' : parse(window.location.hash) ?? '/';
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const next = parse(window.location.hash);
    if (next && next !== current) {
      current = next;
      listeners.forEach((l) => l());
    }
  });
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => current,
    () => current
  );
}

export function navigate(path: Route) {
  window.location.hash = path === '/' ? '/' : path;
}

export const href = (path: Route) => `#${path}`;
