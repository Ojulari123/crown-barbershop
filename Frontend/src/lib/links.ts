'use client';

// The design used a tiny hash router (#/prices); this keeps its exports
// (PAGES, Route, useRoute, navigate, href) on top of real Next.js paths (/prices).

import { usePathname } from 'next/navigation';
import { PAGES, type Route } from './routes';

export { PAGES, href, type Route } from './routes';

const KNOWN = new Set<string>(PAGES.map((p) => p.path));

export function toRoute(pathname: string | null): Route {
  const path = (pathname ?? '/').replace(/\/+$/, '') || '/';
  return (KNOWN.has(path) ? path : '/not-found') as Route;
}

export function useRoute(): Route {
  return toRoute(usePathname());
}

// The site shell registers Next's router here so plain functions can navigate.
let push: ((path: string) => void) | null = null;
export function setNavigator(fn: ((path: string) => void) | null) {
  push = fn;
}

export function navigate(path: Route) {
  if (push) push(path);
  else window.location.assign(path);
}
