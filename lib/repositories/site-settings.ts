import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";

export async function getPublicSiteSettings(): Promise<Record<string, Record<string, unknown>>> {
  if (isDemoMode()) {
    return { "site.brand": { name: "Học Online", tagline: "Khóa học và kiểm tra online" } };
  }
  const client = await createClient();
  const { data, error } = await client.from("site_settings").select("key,value").eq("status", "published").eq("is_public", true);
  if (error) throw new Error("Không thể tải cài đặt website.");
  return Object.fromEntries(data.map((row) => [row.key, row.value]));
}
