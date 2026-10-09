export type Course = {
  id: string;
  title: string;
  slug: string;
  category: string;
  teacherName: string;
  teacherLink?: string;
  courseLink?: string;
  thumbnail?: string;
  description?: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  theme: "orange" | "blue" | "green" | "cyan";
  published: boolean;
};

export type QuizQuestion = {
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  content: string;
  options?: string[];
  correctAnswer: string | string[];
  points: number;
};

export type Quiz = {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  attemptLimit: number;
  status: "draft" | "published" | "closed";
};

export type AttemptRanking = {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  durationSeconds: number;
  rank: number;
  isCurrent?: boolean;
};
