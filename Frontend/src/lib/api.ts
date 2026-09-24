// Same-origin fetch wrapper for the FastAPI backend (docs/api-contract.md).
//
// Auth lives in httpOnly cookies, so there is no token in JS. Two rules on top of fetch:
//  1. Every non-GET call to /api/auth/* and /api/admin/* sends `X-Crown: 1` (CSRF, contract D2).
//  2. A 401 from an admin/auth call gets exactly one POST /api/auth/refresh, then one retry.
//     If that still fails, `onAuthLost` listeners run (the admin shows the login screen).

export class ApiError extends Error {
  status: number;
  code: string;
  detail: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Normalize a FastAPI error body into `{code, message}`.
 * App errors are `{detail: {code, message}}`; validation errors are `{detail: [{msg, ...}]}`;
 * plain HTTPException bodies are `{detail: "text"}`.
 */
export function parseErrorDetail(body: unknown, fallback = 'Request failed'): { code: string; message: string } {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return { code: 'error', message: detail };
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((e) => (typeof e === 'object' && e && 'msg' in e ? String((e as { msg: unknown }).msg) : String(e)))
      .map((m) => m.replace(/^Value error,\s*/, ''))
      .filter(Boolean);
    return { code: 'validation', message: msgs.length ? msgs.join('. ') : fallback };
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { code?: unknown; message?: unknown };
    return { code: typeof d.code === 'string' ? d.code : 'error', message: typeof d.message === 'string' ? d.message : fallback };
  }
  return { code: 'error', message: fallback };
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  /** internal: set on the retry after a refresh */
  retried?: boolean;
};

const authLost = new Set<() => void>();
export function onAuthLost(fn: () => void) {
  authLost.add(fn);
  return () => {
    authLost.delete(fn);
  };
}

let refreshing: Promise<boolean> | null = null;

// One refresh in flight at a time: the backend rotates the refresh token and treats a
// second use of the old one as theft (reuse detection), so parallel refreshes must share.
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'X-Crown': '1' } })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

const needsCsrf = (path: string, method: string) => method !== 'GET' && /^\/api\/(auth|admin)\//.test(path);
const canRefresh = (path: string) => /^\/api\/(admin\/|auth\/me$)/.test(path);

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (needsCsrf(path, method)) headers['X-Crown'] = '1';
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the server.');
  }
  if (res.status === 401 && canRefresh(path)) {
    if (!opts.retried && (await refreshSession())) return request<T>(path, { ...opts, retried: true });
    authLost.forEach((fn) => fn());
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const { code, message } = parseErrorDetail(data, res.statusText || 'Request failed');
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
