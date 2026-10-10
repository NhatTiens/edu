import "server-only";
import { cache } from "react";
import { defaultPresentation,presentationSchema } from "@/lib/site-presentation";
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

export const getSitePresentation=cache(async function getSitePresentation(){
 const settings=await getPublicSiteSettings();
 const parsed=presentationSchema.safeParse({...defaultPresentation,...settings['site.presentation']});
 return parsed.success?parsed.data:defaultPresentation;
});
