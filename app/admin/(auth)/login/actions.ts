"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/config";
import { getAdmin } from "@/lib/auth/admin";
export async function signIn(_state: { error: string }, formData: FormData) {
  if (!hasSupabaseConfig()) return { error: "Chưa cấu hình Supabase. Vui lòng cấu hình theo README." };
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 1024) return { error: "Vui lòng nhập email và mật khẩu hợp lệ." };
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: "Không thể đăng nhập. Kiểm tra thông tin hoặc thử lại sau." };
  if (!await getAdmin()) {
    await client.auth.signOut();
    return { error: "Tài khoản chưa được cấp quyền quản trị." };
  }
  redirect("/admin");
}
