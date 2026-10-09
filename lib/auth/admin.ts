import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/config';
export async function getAdmin() {
  if (!hasSupabaseConfig()) return null;
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const membership = await client.rpc('is_admin');
  return !membership.error && membership.data ? user : null;
}
export async function requireAdminPage() {

  if (!await getAdmin()) redirect('/admin/login');
}

