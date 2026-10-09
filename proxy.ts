import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig, supabaseConfig } from "@/lib/config";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {

  const login = request.nextUrl.pathname === "/admin/login";
  if (!hasSupabaseConfig()) return login ? NextResponse.next() : NextResponse.redirect(new URL("/admin/login", request.url));
  let response = NextResponse.next({ request });
  const setAll: SetAllCookies = (items, headers) => {
    items.forEach(({ name, value }) => request.cookies.set(name, value));
    response = NextResponse.next({ request });
    items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
  };
  const { url, key } = supabaseConfig();
  const client = createServerClient<Database>(url, key, { cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') ?? process.env.NODE_ENV === 'production' }, cookies: { getAll: () => request.cookies.getAll(), setAll } });
  const { data: { user } } = await client.auth.getUser();
  let isAdmin = false;
  if (user) {
    const membership = await client.rpc('is_admin');
    isAdmin = !membership.error && membership.data === true;
  }
  if ((!user || !isAdmin) && !login) {
    const redirect = NextResponse.redirect(new URL("/admin/login", request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  if (login && isAdmin) {
    const admin = NextResponse.redirect(new URL("/admin", request.url));
    response.cookies.getAll().forEach(cookie => admin.cookies.set(cookie));
    return admin;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/admin/:path*"] };

