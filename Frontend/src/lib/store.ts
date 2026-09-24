'use client';

// Shared shop data for the website and the admin portal.
//
// The design kept everything in localStorage. This adapter keeps the design's exact API
// (useCrown, setSlice, resetDemo, storageUsedKb and every helper) so the components port
// unchanged, and swaps the internals for the FastAPI backend (docs/api-contract.md section 8):
//  - site:  state comes from GET /api/public/state, rendered on the server and primed into
//           this module by <CrownProvider> before the first client render (no hydration jump).
//           Writes go through createBooking() / sendMessage().
//  - admin: state comes from GET /api/admin/state after sign-in. setSlice() applies at once
//           (optimistic) and a single FIFO queue syncs it: config slices are PUT whole,
//           entity slices are diffed by id. A failed sync re-reads the server (rollback) and
//           tells <SyncErrorToasts/> through onSyncError().

import { createContext, createElement, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ApiError, onAuthLost, request } from './api';
import { BARBERS, HOURS, SERVICES, clockNow, pinClock, torontoNow, type Barber, type Service } from './data';

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
const CONFIG: Key[] = ['services', 'barbers', 'hours', 'closures', 'notice'];

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === '1';

// ---------- helpers ----------

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function ymdPlus(days: number) {
  return torontoNow(new Date(clockNow() + days * 86_400_000)).ymd;
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

// Used until real data arrives, and by the site if the API cannot be reached.
export function defaults(): CrownState {
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

// ---------- wire types (api-contract.md) ----------

export type Session = { email: string; name: string; role: 'owner' | 'staff' };
export type PublicSlot = { date: string; time: number; barberId: string; status: 'confirmed' };
export type PublicState = Omit<CrownState, 'bookings' | 'messages'> & { bookings: PublicSlot[] };
type AdminMeta = { mediaKb: number; demoMode: boolean; now: { ymd: string; minutes: number; epochMs: number } };
type AdminStateResponse = { state: CrownState; meta: AdminMeta };

// The public API sends booked slots only (no names or phones). Expand them to the Booking
// shape so isSlotTaken() works unchanged. The site never renders bookings.
const slotToBooking = (s: PublicSlot): Booking => ({ id: '', createdAt: 0, name: '', phone: '', note: '', serviceId: '', source: 'online', ...s });

export function fromPublic(p: PublicState): CrownState {
  return {
    services: p.services,
    barbers: p.barbers,
    hours: p.hours,
    gallery: p.gallery,
    bookings: p.bookings.map(slotToBooking),
    messages: [],
    notice: p.notice,
    closures: p.closures,
  };
}

// ---------- the store ----------

let state: CrownState = defaults();
let mode: 'public' | 'admin' | null = null;
let meta: AdminMeta | null = null;
let session: Session | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Swap in fresh server data, keeping the old object for every slice that did not change,
// so components (and their JSON dirty checks) do not churn on a poll.
function replaceState(next: CrownState) {
  let changed = false;
  const out = { ...state } as Record<Key, unknown>;
  for (const k of Object.keys(next) as Key[]) {
    if (JSON.stringify(state[k]) !== JSON.stringify(next[k])) {
      out[k] = next[k];
      changed = true;
    }
  }
  if (changed) {
    state = out as CrownState;
    emit();
  }
}

// The server render hands its state down through context; the client module is primed
// from the same object, so server HTML and the first client render agree.
const CrownCtx = createContext<CrownState | null>(null);
let primedFrom: PublicState | null = null;

export function CrownProvider({ initial, now, children }: { initial: PublicState; now: number; children: ReactNode }) {
  const [snapshot] = useState(() => fromPublic(initial));
  if (typeof window !== 'undefined' && primedFrom !== initial) primeClient(initial, snapshot, now);
  useEffect(() => {
    // Hydration is done: stop using the server's clock, re-render with this device's time.
    pinClock(null);
    state = { ...state };
    emit();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshPublic();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return createElement(CrownCtx.Provider, { value: snapshot }, children);
}

function primeClient(initial: PublicState, snapshot: CrownState, now: number) {
  primedFrom = initial;
  state = snapshot;
  mode = 'public';
  pinClock(now);
}

async function refreshPublic() {
  try {
    const p = await request<PublicState>('/api/public/state');
    if (mode === 'public') replaceState(fromPublic(p));
  } catch {
    /* keep what we have */
  }
}

export function useCrown(): CrownState {
  const server = useContext(CrownCtx);
  return useSyncExternalStore(subscribe, () => state, () => server ?? state);
}

export type SaveResult = { ok: true } | { ok: false; reason: 'full' | 'unavailable' | 'taken' | 'invalid' | 'rate' | 'auth' };
type Reason = Exclude<SaveResult, { ok: true }>['reason'];

function reasonOf(e: unknown): Reason {
  if (!(e instanceof ApiError)) return 'unavailable';
  if (e.status === 401) return 'auth';
  if (e.status === 409) return 'taken';
  if (e.status === 429) return 'rate';
  if (e.status === 0 || e.status >= 500) return 'unavailable';
  return 'invalid';
}

// ---------- site writes ----------

export async function createBooking(input: { serviceId: string; barberId: string; date: string; time: number; name: string; phone: string; note: string }): Promise<SaveResult> {
  try {
    const res = await request<{ slot: PublicSlot }>('/api/public/bookings', { method: 'POST', body: input });
    state = { ...state, bookings: [...state.bookings, slotToBooking(res.slot)] };
    emit();
    return { ok: true };
  } catch (e) {
    const reason = reasonOf(e);
    if (reason === 'taken') void refreshPublic();
    return { ok: false, reason };
  }
}

export async function sendMessage(input: { name: string; phone: string; body: string }): Promise<SaveResult> {
  try {
    await request('/api/public/messages', { method: 'POST', body: input });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: reasonOf(e) };
  }
}

// ---------- admin session ----------

const sessionEnd = new Set<() => void>();
export function onSessionEnd(fn: () => void) {
  sessionEnd.add(fn);
  return () => {
    sessionEnd.delete(fn);
  };
}

function endSession() {
  stopPolling();
  queue.length = 0;
  writeSeq++;
  session = null;
  meta = null;
  if (mode === 'admin') {
    mode = null;
    state = defaults();
    emit();
  }
  sessionEnd.forEach((fn) => fn());
}

onAuthLost(() => {
  if (session || mode === 'admin') endSession();
});

export const currentSession = () => session;

export async function getSession(): Promise<Session | null> {
  if (session) return session;
  try {
    session = await request<Session>('/api/auth/me');
  } catch {
    session = null;
  }
  return session;
}

export async function signIn(email: string, password: string, remember: boolean): Promise<Session | null> {
  try {
    session = await request<Session>('/api/auth/login', { method: 'POST', body: { email: email.trim().toLowerCase(), password, remember } });
  } catch {
    session = null;
  }
  return session;
}

export async function signOut() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch {
    /* cookies are cleared server-side; nothing else to do */
  }
  endSession();
}

export const isAdminReady = () => mode === 'admin';

export async function hydrateAdmin(): Promise<boolean> {
  try {
    const r = await request<AdminStateResponse>('/api/admin/state');
    mode = 'admin';
    meta = r.meta;
    state = r.state;
    emit();
    startPolling();
    return true;
  } catch {
    return false;
  }
}

// ---------- admin sync queue ----------

type Item = { key: Key; prev: unknown; value: unknown };
const queue: Item[] = [];
let pumping = false;
let writeSeq = 0;

export function setSlice<K extends Key>(key: K, next: CrownState[K] | ((prev: CrownState[K]) => CrownState[K])): SaveResult {
  if (mode !== 'admin') {
    console.error('crown: setSlice only syncs in the admin', key);
    return { ok: false, reason: 'unavailable' };
  }
  const prev = state[key];
  const value = typeof next === 'function' ? (next as (p: CrownState[K]) => CrownState[K])(prev) : next;
  state = { ...state, [key]: value };
  emit();
  queue.push({ key, prev, value });
  writeSeq++;
  void pump();
  return { ok: true };
}

class UnsupportedDiff extends Error {}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length) {
      let item = queue.shift()!;
      // Config slices are PUT whole, so only the last of a run of edits needs sending.
      if (CONFIG.includes(item.key)) while (queue[0]?.key === item.key) item = queue.shift()!;
      try {
        await sync(item);
      } catch (e) {
        queue.length = 0;
        await failed(e);
      }
    }
  } finally {
    pumping = false;
  }
}

const SYNC_TEXT: Record<Reason, string> = {
  taken: 'That time is already booked. Nothing was changed.',
  invalid: 'That change could not be saved. Nothing was changed.',
  unavailable: "Could not reach the shop's server. Your last change was undone.",
  rate: "Could not reach the shop's server. Your last change was undone.",
  full: 'That change could not be saved. Nothing was changed.',
  auth: 'Your session ended. Sign in again.',
};

const syncErrors = new Set<(e: { reason: Reason; message: string }) => void>();
export function onSyncError(fn: (e: { reason: Reason; message: string }) => void) {
  syncErrors.add(fn);
  return () => {
    syncErrors.delete(fn);
  };
}

async function failed(e: unknown) {
  if (e instanceof UnsupportedDiff) {
    await resync();
    return;
  }
  const reason = reasonOf(e);
  if (reason === 'auth') return; // request() already ended the session (onAuthLost)
  await resync();
  syncErrors.forEach((fn) => fn({ reason, message: SYNC_TEXT[reason] }));
}

async function resync() {
  writeSeq++;
  try {
    const r = await request<AdminStateResponse>('/api/admin/state');
    if (mode !== 'admin') return;
    meta = r.meta;
    replaceState(r.state);
  } catch {
    /* next poll tries again */
  }
}

function unsupported(key: Key, ids: string[]): never {
  console.error('crown: unsupported diff', key, ids);
  throw new UnsupportedDiff(key);
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
function changed<T extends object>(a: T, b: T, keys: (keyof T)[]) {
  const out: Partial<T> = {};
  for (const k of keys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = b[k];
  return out;
}
const isEmpty = (o: object) => Object.keys(o).length === 0;

// data: URLs from the admin's in-browser image shrink become uploads (contract section 5).
const uploaded = new Map<string, string>();
export async function uploadImage(dataUrl: string, kind: 'gallery' | 'portrait'): Promise<string> {
  const hit = uploaded.get(dataUrl);
  if (hit) return hit;
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append('file', blob, `${kind}.${blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`);
  form.append('kind', kind);
  const { url } = await request<{ url: string; bytes: number }>('/api/admin/uploads', { method: 'POST', form });
  uploaded.set(dataUrl, url);
  return url;
}

const BOOKING_KEYS: (keyof Booking)[] = ['name', 'phone', 'note', 'serviceId', 'barberId', 'date', 'time', 'status', 'source'];
const PHOTO_KEYS: (keyof Photo)[] = ['caption', 'style', 'featured', 'createdAt'];

async function sync({ key, prev, value }: Item) {
  switch (key) {
    case 'services':
    case 'hours':
    case 'closures':
      await request(`/api/admin/${key}`, { method: 'PUT', body: value });
      return;
    case 'notice':
      if (value === null) await request('/api/admin/notice', { method: 'DELETE' });
      else await request('/api/admin/notice', { method: 'PUT', body: value });
      return;
    case 'barbers': {
      const body: Barber[] = [];
      for (const b of value as Barber[]) {
        if (b.photo?.startsWith('data:')) {
          const data = b.photo;
          const url = await uploadImage(data, 'portrait');
          state = { ...state, barbers: state.barbers.map((x) => (x.photo === data ? { ...x, photo: url } : x)) };
          emit();
          body.push({ ...b, photo: url });
        } else body.push(b);
      }
      await request('/api/admin/barbers', { method: 'PUT', body });
      return;
    }
    case 'bookings': {
      const before = byId(prev as Booking[]);
      const after = byId(value as Booking[]);
      const removed = [...before.keys()].filter((id) => !after.has(id));
      if (removed.length) unsupported(key, removed);
      for (const [id, b] of after) {
        const old = before.get(id);
        if (!old) continue;
        const p = changed(old, b, BOOKING_KEYS);
        const fixed = (Object.keys({ ...old, ...b }) as (keyof Booking)[]).filter((k) => !BOOKING_KEYS.includes(k));
        if (!isEmpty(changed(old, b, fixed))) unsupported(key, [id]); // id, createdAt, sample are immutable
        if (!isEmpty(p)) await request(`/api/admin/bookings/${encodeURIComponent(id)}`, { method: 'PATCH', body: p });
      }
      for (const [id, b] of after) {
        if (before.has(id)) continue;
        const { sample: _sample, ...body } = b;
        await request('/api/admin/bookings', { method: 'POST', body });
      }
      return;
    }
    case 'messages': {
      const before = byId(prev as Message[]);
      const after = byId(value as Message[]);
      const odd = [...before.keys()].filter((id) => !after.has(id)).concat([...after.keys()].filter((id) => !before.has(id)));
      if (odd.length) unsupported(key, odd);
      for (const [id, m] of after) {
        const p = changed(before.get(id)!, m, ['read', 'archived']);
        if (!isEmpty(p)) await request(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: p });
      }
      return;
    }
    case 'gallery': {
      const before = byId(prev as Photo[]);
      const after = byId(value as Photo[]);
      for (const id of before.keys()) {
        if (!after.has(id)) await request(`/api/admin/gallery/${encodeURIComponent(id)}`, { method: 'DELETE' });
      }
      for (const [id, p] of after) {
        const old = before.get(id);
        if (!old) continue;
        const d = changed(old, p, PHOTO_KEYS);
        if (!isEmpty(d)) await request(`/api/admin/gallery/${encodeURIComponent(id)}`, { method: 'PATCH', body: d });
      }
      for (const [id, p] of after) {
        if (before.has(id)) continue;
        let src = p.src;
        if (src.startsWith('data:')) {
          const data = src;
          src = await uploadImage(data, 'gallery');
          state = { ...state, gallery: state.gallery.map((x) => (x.id === id && x.src === data ? { ...x, src } : x)) };
          emit();
        }
        await request('/api/admin/gallery', { method: 'POST', body: { id, src, caption: p.caption, style: p.style, featured: p.featured, createdAt: p.createdAt } });
      }
      return;
    }
  }
}

// ---------- admin polling (replaces the design's cross-tab `storage` events) ----------

let pollTimer: number | null = null;
const onFocus = () => void poll();

function startPolling() {
  if (pollTimer !== null) return;
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void poll();
  }, 30_000);
  window.addEventListener('focus', onFocus);
}

function stopPolling() {
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
  if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
}

async function poll() {
  if (mode !== 'admin' || queue.length || pumping) return;
  const seq = writeSeq;
  try {
    const r = await request<AdminStateResponse>('/api/admin/state');
    // A write started while this was in flight: its response may predate that write.
    if (mode !== 'admin' || seq !== writeSeq || queue.length || pumping) return;
    meta = r.meta;
    replaceState(r.state);
  } catch {
    /* try again next time */
  }
}

export function resetDemo() {
  if (mode !== 'admin') return;
  queue.length = 0;
  writeSeq++;
  request<AdminStateResponse>('/api/admin/demo/reset', { method: 'POST' })
    .then((r) => {
      meta = r.meta;
      state = r.state;
      emit();
    })
    .catch((e) => failed(e));
}

export function storageUsedKb() {
  return meta?.mediaKb ?? 0;
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
