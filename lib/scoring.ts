import type { QuizQuestion } from "./types";

export function normalizeAnswer(value: string) {
  return value.normalize("NFC").trim().toLocaleLowerCase("vi").replace(/\s+/g, " ");
}

export function isCorrect(question: QuizQuestion, answer: string) {
  if (!answer.trim()) return false;
  const accepted = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
  return accepted.some((item) => normalizeAnswer(item) === normalizeAnswer(answer));
}

export function scoreAttempt(questions: QuizQuestion[], answers: Record<string, string>) {
  return questions.reduce((total, question) => total + (isCorrect(question, answers[question.id] ?? "") ? question.points : 0), 0);
}

/** Server grading helper for the builder model. Never send BuilderQuestion to participants. */
export function isBuilderAnswerCorrect(question: import('./quiz-builder').BuilderQuestion, answer: string | boolean) {
 if (question.type === 'true_false') return typeof answer === 'boolean' && answer === question.correct_boolean;
 if (typeof answer !== 'string' || !answer.trim()) return false;
 if (question.type === 'multiple_choice') return answer === question.correct_option_id;
 const normalize = (v: string) => {const trimmed = v.normalize('NFC').trim();return question.case_insensitive ? trimmed.toLowerCase() : trimmed;};
 return question.accepted_answers.some(value => normalize(value) === normalize(answer));
}
