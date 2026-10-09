import Link from "next/link";
import { valueText } from "@/lib/results-data";
import { leaderboard, QuizError } from "@/lib/services/public-quiz";
import { notFound, redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let rows;
  try {
    rows = await leaderboard(slug);
  } catch (e) {
    if (e instanceof QuizError && e.status === 404) notFound();
    if (e instanceof QuizError && e.status === 401) redirect(`/q/${slug}`);
    throw e;
  }
  return (
    <main className="quiz-shell">
      <section className="surface" style={{ padding: 24 }}>
        <h1>Bảng xếp hạng</h1>
        {!rows.length ? (
          <p>Chưa có kết quả hoặc bảng xếp hạng chưa được công bố.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hạng</th>
                  <th>Tên hiển thị</th>
                  <th>Điểm</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rank}>
                    <td>{r.rank}</td>
                    <td>
                      {r.public_fields?.length
                        ? r.public_fields.map((f) => (
                            <div
                              key={f.key}
                              style={{
                                overflowWrap: "anywhere",
                                maxWidth: 300,
                              }}
                            >
                              <span className="small muted">{f.label}: </span>
                              {valueText(f.value)}
                            </div>
                          ))
                        : "Người tham gia"}
                    </td>
                    <td>
                      {r.score === null
                        ? "Chưa công bố"
                        : `${r.score}/${r.max_score}`}
                    </td>
                    <td>{(r.duration_ms / 1000).toFixed(1)} giây</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link className="btn btn-outline" href={`/q/${slug}`}>
          Quay lại
        </Link>
      </section>
    </main>
  );
}
