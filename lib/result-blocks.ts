import { z } from "zod";
export function externalUrl(value: string) {
  try {
    if (/[\s\\]/.test(value)) return null;
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function youtubeEmbed(value: string) {
  const safe = externalUrl(value);
  if (!safe) return null;
  const u = new URL(safe);
  if (u.port) return null;
  let id: string | null = null;
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
  ) {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else
      id = u.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
  } else if (u.hostname === "youtu.be")
    id = u.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
  else if (u.hostname === "www.youtube-nocookie.com")
    id = u.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})$/)?.[1] ?? null;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id)
    ? `https://www.youtube-nocookie.com/embed/${id}`
    : null;
}
export const resultBlockSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["text", "youtube", "external_link", "button", "image"]),
    title: z.string().trim().max(200),
    content: z.string().max(10000),
    url: z.string().trim().max(2000),
    visibility: z.enum(["after_submit", "after_quiz_closed", "scheduled_at"]),
    scheduled_at: z.string(),
  })
  .superRefine((b, c) => {
    if (b.type === "text" && !b.content.trim())
      c.addIssue({
        code: "custom",
        path: ["content"],
        message: "Nhập nội dung văn bản.",
      });
    if (b.type === "youtube" && !youtubeEmbed(b.url))
      c.addIssue({
        code: "custom",
        path: ["url"],
        message: "URL YouTube không hợp lệ (video ID 11 ký tự).",
      });
    if (!["text", "youtube"].includes(b.type) && !externalUrl(b.url))
      c.addIssue({
        code: "custom",
        path: ["url"],
        message: "URL phải dùng http hoặc https.",
      });
    if (
      b.visibility === "scheduled_at" &&
      (!b.scheduled_at ||
        !z.iso.datetime({ offset: true }).safeParse(b.scheduled_at).success)
    )
      c.addIssue({
        code: "custom",
        path: ["scheduled_at"],
        message: "Chọn thời điểm hiển thị hợp lệ.",
      });
  });
export const resultDocumentSchema = z
  .object({
    quiz_id: z.uuid(),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    show_percentage: z.boolean(),
    show_correct_count: z.boolean(),
    show_wrong_count: z.boolean(),
    show_duration: z.boolean(),
    blocks: z.array(resultBlockSchema).max(100),
  })
  .superRefine((d, c) => {
    if (new Set(d.blocks.map((b) => b.id)).size !== d.blocks.length)
      c.addIssue({ code: "custom", message: "ID block bị trùng." });
  });
export const adminResultDocumentSchema = resultDocumentSchema.and(
  z.object({
    title: z.string(),
    show_score: z.boolean(),
    show_rank: z.boolean(),
    show_correct_answers: z.boolean(),
  }),
);
export type ResultBlock = z.infer<typeof resultBlockSchema>;
export type ResultDocument = z.infer<typeof resultDocumentSchema>;
export type AdminResultDocument = z.infer<typeof adminResultDocumentSchema>;
export type PublicResultBlock = Pick<
  ResultBlock,
  "id" | "type" | "title" | "content" | "url"
>;
