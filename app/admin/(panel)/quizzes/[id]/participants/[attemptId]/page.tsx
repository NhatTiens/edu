import { notFound } from "next/navigation";
import { resultsReport } from "@/lib/repositories/results-data";
import {
  answerText,
  durationText,
  valueText,
  type AttemptReport,
} from "@/lib/results-data";
import { ResultsNav } from "@/components/admin/ResultsNav";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await params;
  const data = await resultsReport<AttemptReport>(
    id,
    "detail",
    "",
    1,
    attemptId,
  );
  if (!data) notFound();
  const a = data.attempt;
  return (
    <>
      <ResultsNav id={id} />
      <h1 className="admin-page-title">Chi tiết bài làm</h1>
      <p>{data.title}</p>
      <section className="admin-card stack">
        <h2>Thông tin người tham gia</h2>
        {Object.entries(a.participant_data).map(([key, value]) => (
          <p key={key} style={{ overflowWrap: "anywhere" }}>
            <strong>
              {data.fields.find((f) => f.key === key)?.label ?? key}:
            </strong>{" "}
            {valueText(value)}
          </p>
        ))}
        <p>
          Trạng thái: {a.status === "submitted" ? "Đã nộp" : "Chưa nộp"} · Điểm:{" "}
          {a.status === "submitted" ? `${a.score}/${a.max_score}` : "Chưa chấm"}{" "}
          · Hạng: {a.rank ?? "—"} · Thời gian: {durationText(a.duration_ms)}
        </p>
      </section>
      <section className="admin-card stack" style={{ marginTop: 16 }}>
        <h2>Chi tiết câu trả lời</h2>
        <p className="muted">
          Nội dung và đáp án lấy từ bản đề đã lưu khi bắt đầu bài làm. Chỉ Admin
          được truy cập.
        </p>
        {data.questions.map((q, i) => (
          <article
            key={q.id}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
              overflowWrap: "anywhere",
            }}
          >
            <h3>
              Câu {i + 1}: {q.content}
            </h3>
            <p>Người làm trả lời: {answerText(q.answer, q.type, q.options)}</p>
            <p>
              Đáp án đúng:{" "}
              <strong>{answerText(q.correct, q.type, q.options)}</strong>
            </p>
            <p>
              {q.is_correct === null
                ? "Chưa chấm"
                : q.is_correct
                  ? "Đúng"
                  : "Sai / bỏ trống"}{" "}
              · Điểm nhận: {q.points_awarded ?? "—"} / {q.points}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
