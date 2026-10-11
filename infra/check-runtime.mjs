// Read-only dependency check; does not log credentials, bodies or participant data.
const base = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!base || !key || !process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.QUIZ_SESSION_SECRET || '').length < 32)
  throw new Error('Missing required runtime configuration.');
for (const path of ['/auth/v1/health', '/rest/v1/courses?select=id&limit=1']) {
  try {
    const response = await fetch(new URL(path, base), { headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`PASS ${path.split('?')[0]}`);
  } catch {
    console.error(`FAIL ${path.split('?')[0]}: check Supabase, transport, grants and key.`);
    process.exitCode = 1;
  }
}
