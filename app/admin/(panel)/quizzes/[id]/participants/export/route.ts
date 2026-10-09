import { getAdmin } from "@/lib/auth/admin";
import { resultsReport } from "@/lib/repositories/results-data";
import { participantsCsv, type ParticipantReport } from "@/lib/results-data";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdmin()))
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  const { id } = await params;
  try {
    const report = await resultsReport<ParticipantReport>(
      id,
      "export",
      new URL(request.url).searchParams.get("search") ?? "",
    );
    if (!report) return new Response("Not found", { status: 404 });
    return new Response(participantsCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="participants-${id}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return new Response(
      e instanceof Error && e.message === "EXPORT_TOO_LARGE"
        ? "Quá 10.000 lượt. Hãy thu hẹp tìm kiếm trước khi xuất CSV."
        : "Không thể xuất dữ liệu.",
      {
        status:
          e instanceof Error && e.message === "EXPORT_TOO_LARGE" ? 413 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
