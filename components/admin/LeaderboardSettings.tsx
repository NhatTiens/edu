"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLeaderboard } from "@/app/admin/leaderboard-actions";
import type { ParticipantReport } from "@/lib/results-data";
export function LeaderboardSettings({ report }: { report: ParticipantReport }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(report.show_rank);
  const [keys, setKeys] = useState(
    report.fields
      .filter((f) => f.show_on_leaderboard && f.status === "published")
      .map((f) => f.key),
  );
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <section className="admin-card stack" style={{ marginBottom: 16 }}>
      <h2>Quyền hiển thị công khai</h2>
      <fieldset disabled={pending} className="cms-fieldset stack">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          Hiện bảng xếp hạng
        </label>
        <p>
          Chỉ các trường được chọn dưới đây xuất hiện công khai, kể cả với bài
          làm cũ. Không chọn trường nào sẽ dùng “Người tham gia”.
        </p>
        {report.fields
          .filter((f) => f.status === "published")
          .map((f) => (
            <label key={f.key}>
              <input
                type="checkbox"
                checked={keys.includes(f.key)}
                onChange={(e) =>
                  setKeys(
                    e.target.checked
                      ? [...keys, f.key]
                      : keys.filter((k) => k !== f.key),
                  )
                }
              />{" "}
              {f.label}
            </label>
          ))}
        <button
          className="btn btn-primary"
          onClick={() =>
            start(async () => {
              try {
                const result = await saveLeaderboard({
                  id: report.quiz_id,
                  revision: report.revision,
                  enabled,
                  keys,
                });
                setMessage(result.message);
                if (result.ok) router.refresh();
              } catch {
                setMessage("Mất kết nối. Vui lòng thử lại.");
              }
            })
          }
        >
          {pending ? "Đang lưu…" : "Lưu cấu hình"}
        </button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
