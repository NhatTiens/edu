"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/config";

export async function logout() {
  if (hasSupabaseConfig()) {
    const client = await createClient();
    await client.auth.signOut();
  }
  redirect("/admin/login");
}
