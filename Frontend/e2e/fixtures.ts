import { type APIRequestContext } from '@playwright/test';

/** Where auth.setup.ts writes the signed-in owner session (gitignored). */
export const OWNER_STATE = 'playwright/.auth/owner.json';

/**
 * The demo owner that `seed.py --demo` creates (the design's public demo login). Override for
 * any other database with E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD.
 */
export const OWNER = {
  email: process.env.E2E_OWNER_EMAIL ?? 'owner@crownbarbershop.ca',
  password: process.env.E2E_OWNER_PASSWORD ?? 'crown2026',
};

/** A short unique tag so every run's rows can be told apart in a shared database. */
export const stamp = () => Date.now().toString(36).slice(-5);

type AdminBooking = { id: string; name: string; phone: string; status: string; date: string; time: number; barberId: string };
type AdminMessage = { id: string; name: string; body: string };

/** GET /api/admin/state with the owner session's cookies. */
export async function adminState(request: APIRequestContext) {
  const res = await request.get('/api/admin/state');
  if (!res.ok()) throw new Error(`GET /api/admin/state -> ${res.status()}`);
  return (await res.json()).state as { bookings: AdminBooking[]; messages: AdminMessage[] };
}
