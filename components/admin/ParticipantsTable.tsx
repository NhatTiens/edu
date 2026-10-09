import Link from "next/link";
import {
  durationText,
  valueText,
  type ParticipantReport,
} from "@/lib/results-data";
export function ParticipantsTable({
  report,
  search = "",
  path = "participants",
}: {
  report: ParticipantReport;
  search?: string;
  path?: string;
}) {
  const href = (page: number) =>
    `/admin/quizzes/${report.quiz_id}/${path}?${new URLSearchParams({ search, page: String(page) })}`;
  return (
    <>
      <form
        className="row cms-actions"
        method="get"
        style={{ marginBottom: 16 }}
      >
        <input
          aria-label="Tìm người tham gia"
          className="input"
          name="search"
          defaultValue={search}
          maxLength={200}
          placeholder="Tìm trong thông tin người tham gia..."
          style={{ maxWidth: 360 }}
        />
        <button className="btn btn-primary">Tìm</button>
      </form>
      <p>
        {report.total} lượt làm phù hợp. Hạng tính trên toàn bộ lượt đã nộp.
      </p>
      {!report.rows.length ? (
        <p>Chưa có dữ liệu phù hợp.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bài làm</th>
                {report.fields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                {[
                  "Trạng thái",
                  "Điểm",
                  "Đúng",
                  "Sai",
                  "Thời gian",
                  "Hạng",
                  "Nộp lúc (Việt Nam)",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/admin/quizzes/${report.quiz_id}/participants/${r.id}`}
                    >
                      Chi tiết {r.id.slice(0, 8)}
                    </Link>
                  </td>
                  {report.fields.map((f) => (
                    <td
                      key={f.key}
                      style={{ maxWidth: 260, overflowWrap: "anywhere" }}
                    >
                      {valueText(r.participant_data[f.key])}
                    </td>
                  ))}
                  <td>
                    {r.status === "submitted"
                      ? "Đã nộp"
                      : r.status === "in_progress"
                        ? "Đang làm"
                        : r.status}
                  </td>
                  <td>
                    {r.score === null ? "—" : `${r.score}/${r.max_score}`}
                  </td>
                  <td>{r.correct_count ?? "—"}</td>
                  <td>{r.wrong_count ?? "—"}</td>
                  <td>{durationText(r.duration_ms)}</td>
                  <td>{r.rank ?? "—"}</td>
                  <td>
                    {r.submitted_at
                      ? new Date(r.submitted_at).toLocaleString("vi-VN", {
                          timeZone: "Asia/Ho_Chi_Minh",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row cms-actions" style={{ marginTop: 16 }}>
        {report.page > 1 && (
          <Link className="btn btn-outline" href={href(report.page - 1)}>
            Trang trước
          </Link>
        )}
        <span>
          Trang {report.page}/
          {Math.max(1, Math.ceil(report.total / report.page_size))}
        </span>
        {report.page * report.page_size < report.total && (
          <Link className="btn btn-outline" href={href(report.page + 1)}>
            Trang sau
          </Link>
        )}
      </div>
    </>
  );
}
