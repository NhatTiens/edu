import "server-only";
import { z } from "zod";
import { cmsClient } from "./cms";
import { adminResultDocumentSchema } from "@/lib/result-blocks";
export async function getResultDocument(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const client = await cmsClient();
  const { data, error } = await client.rpc("admin_result_document", {
    p_id: id,
  });
  if (error)
    throw new Error("Không thể tải Result Builder. Kiểm tra migration 0007.");
  if (!data) return null;
  const document = JSON.parse(data);
  document.blocks = document.blocks.map((block: { scheduled_at: string }) => ({
    ...block,
    scheduled_at: block.scheduled_at
      ? new Date(block.scheduled_at).toISOString()
      : "",
  }));
  return adminResultDocumentSchema.parse(document);
}
