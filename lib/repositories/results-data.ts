import "server-only";
import { z } from "zod";
import { cmsClient } from "./cms";
import type {
  ParticipantReport,
  AttemptReport,
  AnalyticsReport,
} from "@/lib/results-data";
export async function resultsReport<
  T extends ParticipantReport | AttemptReport | AnalyticsReport,
>(
  id: string,
  op: "participants" | "leaderboard" | "detail" | "analytics" | "export",
  search = "",
  page = 1,
  attempt?: string,
): Promise<T | null> {
  if (
    !z.uuid().safeParse(id).success ||
    (attempt && !z.uuid().safeParse(attempt).success)
  )
    return null;
  const client = await cmsClient();
  const { data, error } = await client.rpc("admin_results", {
    p_quiz: id,
    p_op: op,
    p_search: search.slice(0, 200),
    p_page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    p_size: 25,
    ...(attempt ? { p_attempt: attempt } : {}),
  });
  if (error) {
    if (error.message.includes("NOT_FOUND")) return null;
    if (error.message.includes("EXPORT_TOO_LARGE"))
      throw new Error("EXPORT_TOO_LARGE");
    throw new Error(
      "Không tải được dữ liệu kết quả. Kiểm tra kết nối và migration 0009.",
    );
  }
  return JSON.parse(data) as T;
}
