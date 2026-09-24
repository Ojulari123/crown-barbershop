// Shared shop data for the website and the admin portal.
//
// DEMO STORAGE: everything lives in this browser's localStorage, so the admin
// and the site only "talk" when opened in the same browser. Before launch this
// file is the one piece to swap for a real backend (Supabase, Firebase, or the
// shop's booking tool). Every component reads and writes through it.

import { useSyncExternalStore } from 'react';
import { BARBERS, HOURS, SERVICES, torontoNow, type Barber, type Service } from './data';

export type CutStyle = 'fade' | 'classic' | 'beard' | 'kids' | 'shave';
export const STYLE_LABELS: Record<CutStyle, string> = {
  fade: 'Fades',
  classic: 'Classic cuts',
  beard: 'Beards',
  kids: 'Kids',
  shave: 'Shaves',
};
// Which service "Book this cut" should pre-select for each style.
export const STYLE_SERVICE: Record<CutStyle, string> = {
  fade: 'fade',
  classic: 'classic',
  beard: 'beard',
  kids: 'kids',
  shave: 'hot-towel',
};

export type Photo = {
  id: string;
  src: string;
  caption: string;
  style: CutStyle;
  featured: boolean;
  createdAt: number;
  sample?: boolean;
};

export type BookingStatus = 'requested' | 'confirmed' | 'done' | 'cancelled' | 'no-show';
export type Booking = {
  id: string;
  createdAt: number;
  name: string;
  phone: string;
  note: string;
  serviceId: string;
  barberId: string;
  date: string; // YYYY-MM-DD, Toronto
  time: number; // minutes after midnight
  status: BookingStatus;
  source: 'online' | 'phone' | 'walk-in';
  sample?: boolean;
};

export type Message = {
  id: string;
  createdAt: number;
  name: string;
  phone: string;
  body: string;
  read: boolean;
  archived: boolean;
  sample?: boolean;
};

export type Notice = { text: string; until: string | null } | null;
export type Hours = [number, number][][];

export type CrownState = {
  services: Service[];
  barbers: Barber[];
  hours: Hours;
  gallery: Photo[];
  bookings: Booking[];
  messages: Message[];
  notice: Notice;
  closures: string[]; // YYYY-MM-DD days off (holidays, sick days)
};

type Key = keyof CrownState;
const KEYS: Key[] = ['services', 'barbers', 'hours', 'gallery', 'bookings', 'messages', 'notice', 'closures'];
const PREFIX = 'crown:v1:';
const SEEDED = PREFIX + 'seeded';

// ---------- helpers ----------

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function ymdPlus(days: number) {
  return torontoNow(new Date(Date.now() + days * 86_400_000)).ymd;
}

export function dayOfYmd(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export function fmtYmd(ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function relativeDay(ymd: string) {
  const today = torontoNow().ymd;
  if (ymd === today) return 'Today';
  if (ymd === ymdPlus(1)) return 'Tomorrow';
  if (ymd === ymdPlus(-1)) return 'Yesterday';
  return fmtYmd(ymd, { weekday: 'short', month: 'short', day: 'numeric' });
}

const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=1100&q=75&auto=format&fit=crop`;

// Stand-in photos so the gallery is not empty in the demo. The admin can remove them in one click.
function samplePhotos(): Photo[] {
  const list: [string, string, CutStyle, boolean][] = [
    ['1648221122323-572c13a31663', 'Skin fade, blended by hand', 'fade', true],
    ['1582771498000-8ad44e6c84db', 'Classic pompadour', 'classic', true],
    ['1599011176306-4a96f1516d4d', 'Full beard, shaped with scissors', 'beard', true],
    ['1640301133543-41fe25ad6450', 'Short crop with a sharp line-up', 'classic', true],
    ['1567894340315-735d7c361db0', 'Taper with curls left on top', 'fade', true],
    ['1593702275687-f8b402bf1fb5', 'Mid fade, textured top', 'fade', false],
    ['1701885183616-cf00e2db1a3b', 'Scissor over comb', 'classic', false],
    ['1630827020718-3433092696e7', 'Beard shape-up', 'beard', false],
    ['1568339434343-2a640a1a9946', 'Fade with a hard-part design', 'fade', false],
    ['1578390432942-d323db577792', 'French crop', 'classic', false],
    ['1635273051839-003bf06a8751', 'Clipper work on the sides', 'classic', false],
    ['1599834562135-b6fc90e642ca', 'Textured quiff with a trimmed beard', 'beard', false],
  ];
  const now = Date.now();
  return list.map(([id, caption, style, featured], i) => ({
    id: 'sample-' + i,
    src: u(id),
    caption,
    style,
    featured,
    createdAt: now - i * 86_400_000 * 3,
    sample: true,
  }));
}

function sampleBookings(): Booking[] {
  const rows: [number, number, string, string, string, string, Booking['status'], Booking['source']][] = [
    [0, 630, 'Marcus Bell', 'fade', 'tania', '519-555-0147', 'confirmed', 'online'],
    [0, 690, 'Graham Whitfield', 'senior', 'any', '519-555-0183', 'confirmed', 'phone'],
    [0, 930, 'Daniel Okafor', 'cut-beard', 'tania', '519-555-0112', 'requested', 'online'],
    [0, 990, 'Luis Ferreira', 'classic', 'any', '519-555-0165', 'requested', 'online'],
    [1, 600, 'Tom Kowalski', 'beard', 'any', '519-555-0129', 'confirmed', 'phone'],
    [1, 960, 'Ethan Moreau', 'kids', 'tania', '519-555-0171', 'requested', 'online'],
    [2, 660, 'Bill Hendry', 'hot-towel', 'tania', '519-555-0104', 'confirmed', 'online'],
    [-1, 720, 'Sam Achebe', 'fade', 'any', '519-555-0138', 'done', 'online'],
    [-1, 780, 'Owen Price', 'classic', 'tania', '519-555-0192', 'no-show', 'phone'],
  ];
  return rows.map(([d, time, name, serviceId, barberId, phone, status, source], i) => ({
    id: 'sample-b' + i,
    createdAt: Date.now() - (i + 1) * 3_600_000,
    name,
    phone,
    note: i === 2 ? 'Keeping the length on top, just clean it up.' : '',
    serviceId,
    barberId,
    date: ymdPlus(d),
    time,
    status,
    source,
    sample: true,
  }));
}

function sampleMessages(): Message[] {
  const now = Date.now();
  return [
    {
      id: 'sample-m0',
      createdAt: now - 40 * 60_000,
      name: 'Carol Mitchell',
      phone: '519-555-0158',
      body: 'Hi, my father uses a walker. Is there a step at the front door, and is there parking close by?',
      read: false,
      archived: false,
      sample: true,
    },
    {
      id: 'sample-m1',
      createdAt: now - 5 * 3_600_000,
      name: 'Jordan Reyes',
      phone: '519-555-0176',
      body: 'Do you do flat tops? Looking for someone who can do one properly.',
      read: false,
      archived: false,
      sample: true,
    },
    {
      id: 'sample-m2',
      createdAt: now - 2 * 86_400_000,
      name: 'Peter Lang',
      phone: '519-555-0120',
      body: 'Will you be open the Saturday of the long weekend?',
      read: true,
      archived: false,
      sample: true,
    },
  ];
}

function defaults(): CrownState {
  return {
    services: SERVICES.map((s) => ({ ...s, visible: true })),
    barbers: BARBERS,
    hours: HOURS,
    gallery: [],
    bookings: [],
    messages: [],
    notice: null,
    closures: [],
  };
}

// ---------- storage ----------

const canStore = typeof window !== 'undefined' && (() => {
  try {
    const k = PREFIX + 'probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

function read(): CrownState {
  const base = defaults();
  if (!canStore) return base;
  if (!window.localStorage.getItem(SEEDED)) {
    const seeded = { ...base, gallery: samplePhotos(), bookings: sampleBookings(), messages: sampleMessages() };
    for (const k of KEYS) window.localStorage.setItem(PREFIX + k, JSON.stringify(seeded[k]));
    window.localStorage.setItem(SEEDED, '1');
    return seeded;
  }
  const out = { ...base } as Record<Key, unknown>;
  for (const k of KEYS) {
    const raw = window.localStorage.getItem(PREFIX + k);
    if (raw == null) continue;
    try {
      out[k] = JSON.parse(raw);
    } catch {
      /* keep default */
    }
  }
  return out as CrownState;
}

let state: CrownState = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  // Another tab (the admin or the site) changed something: pick it up live.
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(PREFIX)) {
      state = read();
      emit();
    }
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useCrown(): CrownState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export type SaveResult = { ok: true } | { ok: false; reason: 'full' | 'unavailable' };

export function setSlice<K extends Key>(key: K, next: CrownState[K] | ((prev: CrownState[K]) => CrownState[K])): SaveResult {
  const value = typeof next === 'function' ? (next as (p: CrownState[K]) => CrownState[K])(state[key]) : next;
  if (canStore) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      return { ok: false, reason: 'full' };
    }
  }
  state = { ...state, [key]: value };
  emit();
  return canStore ? { ok: true } : { ok: false, reason: 'unavailable' };
}

export function resetDemo() {
  if (canStore) {
    for (const k of KEYS) window.localStorage.removeItem(PREFIX + k);
    window.localStorage.removeItem(SEEDED);
  }
  state = read();
  emit();
}

export function storageUsedKb() {
  if (!canStore) return 0;
  let n = 0;
  for (const k of KEYS) n += (window.localStorage.getItem(PREFIX + k) ?? '').length;
  return Math.round((n * 2) / 1024);
}

// ---------- derived helpers ----------

export function visibleServices(s: CrownState) {
  return s.services.filter((x) => x.visible !== false);
}

export function activeNotice(s: CrownState) {
  if (!s.notice || !s.notice.text.trim()) return null;
  if (s.notice.until && s.notice.until < torontoNow().ymd) return null;
  return s.notice;
}

// Photos for the homepage: starred ones first, then newest, max 5.
export function homepagePhotos(s: CrownState) {
  const sorted = [...s.gallery].sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt - a.createdAt);
  return sorted.slice(0, 5);
}

// A slot is taken when the chosen barber already has it, or when "first available"
// is picked and every barber is busy at that time.
export function isSlotTaken(s: CrownState, date: string, time: number, barberId: string) {
  const live = s.bookings.filter((b) => b.date === date && b.time === time && b.status !== 'cancelled');
  const realBarbers = s.barbers.filter((b) => b.id !== 'any').length || 1;
  if (barberId === 'any') return live.length >= realBarbers;
  return live.some((b) => b.barberId === barberId) || live.length >= realBarbers;
}

// Opening ranges for a specific date: none on a day off, otherwise the weekly hours.
export function hoursOn(s: CrownState, ymd: string): [number, number][] {
  if ((s.closures ?? []).includes(ymd)) return [];
  return s.hours[dayOfYmd(ymd)] ?? [];
}

export const isDayOff = (s: CrownState, ymd: string) => (s.closures ?? []).includes(ymd);
