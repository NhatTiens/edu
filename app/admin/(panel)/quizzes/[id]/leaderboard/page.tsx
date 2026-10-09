import { notFound } from "next/navigation";
import { resultsReport } from "@/lib/repositories/results-data";
import type { ParticipantReport } from "@/lib/results-data";
import { ResultsNav } from "@/components/admin/ResultsNav";
import { ParticipantsTable } from "@/components/admin/ParticipantsTable";
import { LeaderboardSettings } from "@/components/admin/LeaderboardSettings";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const search =
    typeof query.search === "string" ? query.search.slice(0, 200) : "";
  const report = await resultsReport<ParticipantReport>(
    id,
    "leaderboard",
    search,
    Number(query.page) || 1,
  );
  if (!report) notFound();
  return (
    <>
      <ResultsNav id={id} />
      <h1 className="admin-page-title">Xếp hạng: {report.title}</h1>
      <LeaderboardSettings key={report.revision} report={report} />
      <section className="admin-card">
        <p>
          Điểm giảm dần, thời gian tăng dần, thời điểm nộp tăng dần. UUID phân
          định thứ tự nếu bằng cả ba tiêu chí. Bảng quản trị hiển thị toàn bộ
          thông tin; bảng công khai chỉ có trường được chọn.
        </p>
        <ParticipantsTable report={report} path="leaderboard" search={search} />
      </section>
    </>
  );
}
