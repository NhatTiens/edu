// This module contains validation only; never put credentials in error messages.
export function assertPublicKey(key: string | undefined) {
  if (!key) return;
  let role: string | undefined;
  try {
    const body = key.split(".")[1];
    if (body)
      role = JSON.parse(Buffer.from(body, "base64url").toString("utf8")).role;
  } catch {
    /* Malformed keys will be rejected by Supabase. */
  }
  if (
    key.startsWith("sb_secret_") ||
    role === "service_role" ||
    role === "supabase_admin"
  )
    throw new Error(
      "Privileged Supabase key cannot be used in NEXT_PUBLIC configuration.",
    );
}
export function configuredOrigin(value: string | undefined) {
  if (!value) throw new Error("NEXT_PUBLIC_SITE_URL is required.");
  const u = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash ||
    !(u.protocol === "https:" || (local && u.protocol === "http:"))
  )
    throw new Error(
      "Site URL must be an HTTPS origin (HTTP loopback is allowed for local testing).",
    );
  return u.origin;
}
export function authCookieOptions() {
  const origin = configuredOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  return {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax" as const,
    path: "/",
  };
}
