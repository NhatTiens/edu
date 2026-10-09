import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/config";
import type { Database } from "./database.types";

/** Server-only client for trusted quiz transactions. Never import from a client component. */
export function createServiceClient() {
  const { url } = supabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY cho tác vụ máy chủ.");
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
