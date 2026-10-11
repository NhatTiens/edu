import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Bounded read through the same SSR client used by Server Components. No PII. */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const client = await createClient();
    const { error } = await client.from('courses').select('id').eq('status', 'published').limit(1).abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    return Response.json({ status: 'ready' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
