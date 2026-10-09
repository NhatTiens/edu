export type ResultField = {
  key: string;
  label: string;
  status: string;
  show_on_leaderboard: boolean;
};
export type ParticipantRow = {
  id: string;
  participant_data: Record<string, unknown>;
  status: string;
  score: number | null;
  max_score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  duration_ms: number | null;
  submitted_at: string | null;
  rank: number | null;
};
export type ParticipantReport = {
  quiz_id: string;
  title: string;
  revision: string;
  show_rank: boolean;
  fields: ResultField[];
  rows: ParticipantRow[];
  total: number;
  page: number;
  page_size: number;
};
export type AttemptReport = {
  quiz_id: string;
  title: string;
  fields: ResultField[];
  attempt: ParticipantRow;
  questions: {
    id: string;
    content: string;
    type: string;
    options: { id: string; content: string }[];
    points: number;
    correct: unknown;
    answer: unknown;
    is_correct: boolean | null;
    points_awarded: number | null;
  }[];
};
export type AnalyticsReport = {
  quiz_id: string;
  title: string;
  summary: {
    participant_count: number;
    total_attempts: number;
    completed_attempts: number;
    completion_rate: number;
    average_score: number | null;
    average_duration_ms: number | null;
  };
  questions: {
    id: string;
    content: string;
    completed_count: number;
    correct_count: number;
    correct_rate: number;
  }[];
};
export function valueText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
export function durationText(ms: number | null) {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)} giây`;
}
export function answerText(
  value: unknown,
  type: string,
  options: { id: string; content: string }[],
) {
  if (value == null) return "Bỏ trống";
  if (type === "multiple_choice")
    return options.find((o) => o.id === value)?.content ?? valueText(value);
  if (type === "true_false") return value === true ? "Đúng" : "Sai";
  return valueText(value);
}
export function participantsCsv(
  report: Pick<ParticipantReport, "fields" | "rows">,
) {
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? "" : valueText(value);
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
      text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows: unknown[][] = [
    [
      "attempt_id",
      ...report.fields.map((f) => f.label),
      "status",
      "score",
      "max_score",
      "correct_count",
      "wrong_count",
      "duration_seconds",
      "rank",
      "submitted_at",
    ],
    ...report.rows.map((r) => [
      r.id,
      ...report.fields.map((f) => r.participant_data[f.key]),
      r.status,
      r.score,
      r.max_score,
      r.correct_count,
      r.wrong_count,
      r.duration_ms === null ? null : r.duration_ms / 1000,
      r.rank,
      r.submitted_at,
    ]),
  ];
  return (
    "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}
