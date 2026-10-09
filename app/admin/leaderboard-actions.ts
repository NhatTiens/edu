"use server";
import { z } from "zod";
import { cmsClient } from "@/lib/repositories/cms";
import { revalidatePath } from "next/cache";
const schema = z.object({
  id: z.uuid(),
  revision: z.string().min(1),
  enabled: z.boolean(),
  keys: z.array(z.string().max(100)).max(100),
});
export async function saveLeaderboard(input: unknown) {
  try {
    const d = schema.parse(input);
    const client = await cmsClient();
    const { error } = await client.rpc("admin_leaderboard_settings", {
      p_quiz: d.id,
      p_revision: d.revision,
      p_enabled: d.enabled,
      p_keys: d.keys,
    });
    if (error)
      return {
        ok: false,
        message: error.message.includes("STALE_VERSION")
          ? "Cấu hình đã thay đổi. Tải lại trang trước khi lưu."
          : "Không lưu được cấu hình.",
      };
    revalidatePath(`/admin/quizzes/${d.id}`, "layout");
    revalidatePath("/q", "layout");
    return { ok: true, message: "Đã lưu quyền hiển thị leaderboard." };
  } catch {
    return { ok: false, message: "Kiểm tra phiên quản trị và dữ liệu." };
  }
}
