import Link from "next/link";
import { notFound } from "next/navigation";
import { resultsReport } from "@/lib/repositories/results-data";
import type { ParticipantReport } from "@/lib/results-data";
import { ParticipantsTable } from "@/components/admin/ParticipantsTable";
import { ResultsNav } from "@/components/admin/ResultsNav";
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
    "participants",
    search,
    Number(query.page) || 1,
  );
  if (!report) notFound();
  return (
    <>
      <ResultsNav id={id} />
      <h1 className="admin-page-title">Người tham gia: {report.title}</h1>
      <Link
        className="btn btn-outline"
        href={`/admin/quizzes/${id}/participants/export?${new URLSearchParams({ search })}`}
      >
        Xuất CSV
      </Link>
      <section className="admin-card" style={{ marginTop: 16 }}>
        <ParticipantsTable report={report} search={search} />
      </section>
    </>
  );
}
