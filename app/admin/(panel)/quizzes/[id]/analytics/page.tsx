import { notFound } from "next/navigation";
import { resultsReport } from "@/lib/repositories/results-data";
import { durationText, type AnalyticsReport } from "@/lib/results-data";
import { ResultsNav } from "@/components/admin/ResultsNav";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await resultsReport<AnalyticsReport>(id, "analytics");
  if (!data) notFound();
  const s = data.summary;
  return (
    <>
      <ResultsNav id={id} />
      <h1 className="admin-page-title">Phân tích: {data.title}</h1>
      <div className="stat-grid">
        {[
          ["Người tham gia", s.participant_count],
          ["Tổng lượt làm", s.total_attempts],
          ["Lượt đã hoàn thành", s.completed_attempts],
          ["Tỷ lệ hoàn thành", `${s.completion_rate}%`],
          [
            "Điểm trung bình",
            s.average_score === null ? "—" : Number(s.average_score).toFixed(2),
          ],
          ["Thời gian trung bình", durationText(s.average_duration_ms)],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <div className="stat-value">{value}</div>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="muted">
        Người tham gia được đếm theo mã định danh đã băm, không phải danh tính
        đã xác thực. Tỷ lệ hoàn thành = lượt đã nộp / tổng lượt bắt đầu. Trung
        bình chỉ tính lượt đã nộp; mỗi lượt làm được tính riêng.
      </p>
      <section className="admin-card">
        <h2>Tỷ lệ đúng từng câu</h2>
        <p>
          Mẫu số là số lượt đã nộp có câu hỏi trong bản đề. Bỏ trống được tính
          sai.
        </p>
        {!data.questions.length ? (
          <p>Chưa có bài nộp để phân tích.</p>
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm">
            <table>
              <thead>
                <tr>
                  <th>Câu hỏi</th>
                  <th>Đúng</th>
                  <th>Lượt đã nộp</th>
                  <th>Tỷ lệ đúng</th>
                </tr>
              </thead>
              <tbody>
                {data.questions.map((q, i) => (
                  <tr key={`${q.id}-${i}`}>
                    <td style={{ maxWidth: 600, overflowWrap: "anywhere" }}>
                      {q.content}
                    </td>
                    <td>{q.correct_count}</td>
                    <td>{q.completed_count}</td>
                    <td>{q.correct_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
