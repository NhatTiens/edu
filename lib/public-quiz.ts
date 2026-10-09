import type { PublicResultBlock } from "./result-blocks";
import type { BuilderField } from "./quiz-builder";
export type ParticipantField = Pick<
  BuilderField,
  "id" | "label" | "key" | "type" | "placeholder" | "required" | "options"
>;
export type PublicQuestion = {
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  content: string;
  points: number;
  options: { id: string; content: string }[];
};
export type EntryData = {
  slug: string;
  title: string;
  description: string;
  state: "draft" | "closed" | "scheduled" | "published";
  hasPassword: boolean;
  unlocked: boolean;
  duration_minutes: number | null;
  attempt_limit: number | null;
  open_at: string | null;
  close_at: string | null;
  fields: ParticipantField[];
};
export type Answers = Record<string, string | boolean | null>;
export type AttemptData = {
  id: string;
  title: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  server_now: string;
  questions: PublicQuestion[];
  answers: Answers;
};
export type ResultData = {
  id: string;
  title: string;
  status: string;
  started_at: string;
  submitted_at: string;
  duration_ms: number | null;
  percentage?: number | null;
  blocks?: PublicResultBlock[];
  timed_out: boolean;
  score: number | null;
  max_score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  rank: number | null;
  show_rank: boolean;
  review?: {
    id: string;
    content: string;
    type: string;
    options: { id: string; content: string }[];
    correct: string | string[] | boolean;
    answer?: string | boolean | null;
    is_correct?: boolean;
    points_awarded?: number | null;
  }[];
};
export type LeaderboardRow = {
  public_fields: {key:string;label:string;value:unknown}[];
  rank: number;
  name: string;
  score: number | null;
  max_score: number | null;
  duration_ms: number;
};
export function normalizeIdentifier(value: string, type: string) {
  const text = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (type !== "number") return text;
  const negative = text.startsWith("-");
  const [integer, fraction = ""] = text.replace(/^-/, "").split(".");
  const whole = integer.replace(/^0+(?=\d)/, "");
  const decimals = fraction.replace(/0+$/, "");
  const number = whole + (decimals ? "." + decimals : "");
  return (negative && number !== "0" ? "-" : "") + number;
}
