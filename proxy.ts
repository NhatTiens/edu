import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig, supabaseConfig } from "@/lib/config";
import { authCookieOptions } from "@/lib/security/config";
import { securityHeaders } from "@/lib/security/headers";
import type { Database } from "@/lib/supabase/database.types";
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const headers = securityHeaders(
    nonce,
    process.env.NODE_ENV === "development",
  );
  request.headers.set("x-nonce", nonce);
  request.headers.set(
    "Content-Security-Policy",
    headers["Content-Security-Policy"],
  );
  const secure = (response: NextResponse) => {
    for (const [key, value] of Object.entries(headers))
      response.headers.set(key, value);
    if (process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https:"))
      response.headers.set("Strict-Transport-Security", "max-age=31536000");
    return response;
  };
  let response = NextResponse.next({ request: { headers: request.headers } });
  if (!/^\/admin(?:\/|$)/.test(request.nextUrl.pathname))
    return secure(response);
  const login = request.nextUrl.pathname === "/admin/login";
  if (!hasSupabaseConfig())
    return secure(
      login
        ? response
        : NextResponse.redirect(new URL("/admin/login", request.url)),
    );
  try {
    const cookieOptions = authCookieOptions();
    const setAll: SetAllCookies = (items, extraHeaders) => {
      items.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request: { headers: request.headers } });
      items.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, { ...options, ...cookieOptions }),
      );
      Object.entries(extraHeaders).forEach(([name, value]) =>
        response.headers.set(name, value),
      );
    };
    const { url, key } = supabaseConfig();
    const client = createServerClient<Database>(url, key, {
      cookieOptions,
      cookies: { getAll: () => request.cookies.getAll(), setAll },
    });
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    const membership = !error && user ? await client.rpc("is_admin") : null;
    const admin = membership?.data === true && !membership.error;
    if ((!admin && !login) || (admin && login)) {
      const redirect = NextResponse.redirect(
        new URL(admin ? "/admin" : "/admin/login", request.url),
      );
      response.cookies
        .getAll()
        .forEach((cookie) => redirect.cookies.set(cookie));
      return secure(redirect);
    }
    return secure(response);
  } catch {
    return secure(
      login
        ? response
        : NextResponse.redirect(new URL("/admin/login", request.url)),
    );
  }
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
