// Server-only: the site layout reads GET /api/public/state straight from the backend
// (api-contract.md 3.1). No cache: hours, notices and booked slots change during the day.

import { BARBERS, HOURS, SERVICES } from './data';
import type { PublicState } from './store';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';

// If the API is down the site still renders the shop's standing facts; booking and the
// question form then fail with the design's "please call" message.
function fallback(): PublicState {
  return {
    services: SERVICES.map((s) => ({ ...s, visible: true })),
    barbers: BARBERS,
    hours: HOURS,
    gallery: [],
    bookings: [],
    notice: null,
    closures: [],
  };
}

// Returns the state plus the instant it was read: the client hydrates with that clock
// (data.ts pinClock) so time-dependent text matches the server HTML.
export async function fetchPublicState(forwardedFor: string | null): Promise<{ state: PublicState; now: number }> {
  const now = Date.now();
  try {
    const res = await fetch(`${API_ORIGIN}/api/public/state`, {
      cache: 'no-store',
      // The backend rate-limits per visitor (first X-Forwarded-For hop when TRUST_PROXY=1),
      // so pass the visitor's address along instead of counting every render as this server.
      headers: { Accept: 'application/json', ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}) },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { state: (await res.json()) as PublicState, now };
  } catch (e) {
    console.error('crown: public state unavailable, rendering defaults', e);
    return { state: fallback(), now };
  }
}
