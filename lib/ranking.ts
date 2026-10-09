export type RankableAttempt = { score: number; durationMs: number; submittedAt: string };

export function sortRanking<T extends RankableAttempt>(attempts: T[]) {
  return [...attempts].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });
}
