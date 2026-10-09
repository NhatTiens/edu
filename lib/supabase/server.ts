import "server-only";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/config";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseConfig();
  const setAll: SetAllCookies = (items) => {
    try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
    catch {
      // Server Components cannot write cookies. proxy.ts refreshes them before rendering.
    }
  };
  return createServerClient<Database>(url, key, { cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') ?? process.env.NODE_ENV === 'production' }, cookies: { getAll: () => cookieStore.getAll(), setAll } });
}
