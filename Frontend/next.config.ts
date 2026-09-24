import type { NextConfig } from 'next';

// The browser only ever talks to same-origin /api/*; Next forwards it to the FastAPI backend.
// That keeps the httpOnly auth cookies first-party (docs/api-contract.md section 2).
// 127.0.0.1, not localhost: Safari tries IPv6 ::1 first and uvicorn listens on IPv4 only.
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  devIndicators: false,
  // Always defined, so the build inlines it and drops demo-only code (Login's demo account)
  // when it is not '1'. An unset NEXT_PUBLIC_* var would stay a runtime lookup instead.
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE ?? '',
  },
  poweredByHeader: false,
  // Pin the workspace root so Turbopack does not pick up a stray lockfile higher up.
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
