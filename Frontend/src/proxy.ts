import { NextResponse, type NextRequest } from 'next/server';

// Optimistic gate for /admin/*: without the non-secret `crown_signed_in` hint cookie
// (set by the backend next to the httpOnly tokens) go straight to the login screen.
// The real check is GET /api/auth/me in the portal, and every admin API call.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login' || req.cookies.has('crown_signed_in')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = /^\/admin\/[a-z]+$/.test(pathname) ? `?next=${encodeURIComponent(pathname)}` : '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
