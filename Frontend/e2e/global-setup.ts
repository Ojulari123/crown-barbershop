/** Fails fast, with the fix, when the API is not reachable through the Next rewrite. */
export default async function globalSetup() {
  const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
  // With no E2E_BASE_URL Playwright starts Next itself after this runs, so check the API directly.
  const url = process.env.E2E_BASE_URL ? `${base}/api/health` : `${process.env.API_ORIGIN ?? 'http://127.0.0.1:8000'}/api/health`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    throw new Error(
      `The Crown API is not answering at ${url} (${(e as Error).message}). Start Postgres and the API first:\n` +
        '  cd Backend && .venv/bin/python migrate.py up && .venv/bin/python seed.py --demo && .venv/bin/uvicorn main:app --port 8000\n' +
        'The specs expect DEMO_MODE=1 (SMS dry run) and the demo owner account.',
    );
  }
}
