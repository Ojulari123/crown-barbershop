// Site routes and page titles (server-safe: route metadata reads these).

export type Route = '/' | '/prices' | '/book' | '/gallery' | '/about' | '/visit' | '/not-found';

export const PAGES: { path: Exclude<Route, '/not-found'>; label: string; title: string }[] = [
  { path: '/', label: 'Home', title: 'Crown Barber Shop | Old-school cuts in Guelph' },
  { path: '/about', label: 'About', title: 'About the shop | Crown Barber Shop, Guelph' },
  { path: '/prices', label: 'Prices', title: 'Prices | Crown Barber Shop, Guelph' },
  { path: '/gallery', label: 'Gallery', title: 'Recent cuts | Crown Barber Shop, Guelph' },
  { path: '/visit', label: 'Hours & map', title: 'Hours, map and questions | Crown Barber Shop, Guelph' },
  { path: '/book', label: 'Book', title: 'Reserve a chair | Crown Barber Shop, Guelph' },
];

export const NOT_FOUND_TITLE = 'Page not found | Crown Barber Shop';

export const pageTitle = (path: Route) => PAGES.find((p) => p.path === path)?.title ?? NOT_FOUND_TITLE;

export const href = (path: Route) => path;
