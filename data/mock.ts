import type { AttemptRanking, Course, Quiz, QuizQuestion } from "@/lib/types";

export const categories = ["Tất cả", "Giải tích", "Đại số - Tổ hợp", "Xác suất - Thống kê", "Hình học", "Phương pháp tính", "Ôn thi THPTQG"];

export const courses: Course[] = [
  { id: "c1", title: "Giải Tích 1", slug: "giai-tich-1", category: "Giải tích", teacherName: "A.Vương", teacherLink: "https://facebook.com/", price: 99000, oldPrice: 199000, badge: "Cấp tốc", theme: "orange", published: true },
  { id: "c2", title: "Đại Số Tuyến Tính", slug: "dai-so-tuyen-tinh", category: "Đại số - Tổ hợp", teacherName: "A.Vương", teacherLink: "https://facebook.com/", price: 99000, oldPrice: 199000, badge: "Cấp tốc", theme: "blue", published: true },
  { id: "c3", title: "Xác Suất Thống Kê", slug: "xac-suat-thong-ke", category: "Xác suất - Thống kê", teacherName: "A.Vương", teacherLink: "https://facebook.com/", price: 99000, oldPrice: 199000, badge: "Ôn thi", theme: "green", published: true },
  { id: "c4", title: "Phương Pháp Tính", slug: "phuong-phap-tinh", category: "Phương pháp tính", teacherName: "A.Vương", teacherLink: "https://facebook.com/", price: 99000, oldPrice: 199000, badge: "Ôn thi", theme: "cyan", published: true },
  { id: "c5", title: "Giải Tích 1 Chuyên Sâu", slug: "giai-tich-1-chuyen-sau", category: "Giải tích", teacherName: "A.Vương", teacherLink: "https://facebook.com/", price: 129000, oldPrice: 229000, badge: "Nâng cao", theme: "blue", published: true },
  { id: "c6", title: "Tổng Ôn Giải Tích 1", slug: "tong-on-giai-tich-1", category: "Giải tích", teacherName: "A.Vương", teacherLink: "https://facebook.com/", price: 79000, oldPrice: 159000, badge: "Tổng ôn", theme: "green", published: true },
  { id: "c7", title: "Bài Tập Giải Tích 1", slug: "bai-tap-giai-tich-1", category: "Giải tích", teacherName: "A.Vương", teacherLink: "https://facebook.com/", price: 69000, oldPrice: 139000, badge: "Bài tập", theme: "orange", published: true },
  { id: "c8", title: "Chuyên Đề Giải Tích", slug: "chuyen-de-giai-tich", category: "Giải tích", teacherName: "A.Vương", teacherLink: "https://facebook.com/", price: 99000, oldPrice: 189000, badge: "Chuyên đề", theme: "cyan", published: true }
];

export const quiz: Quiz = {
  id: "q1",
  slug: "giai-tich-1-chuong-1-2",
  title: "Kiểm tra Giải Tích 1 Chương 1 và 2",
  description: "Bài kiểm tra kiến thức trọng tâm chương 1 và 2.",
  durationMinutes: 30,
  questionCount: 20,
  attemptLimit: 1,
  status: "published"
};

export const questions: QuizQuestion[] = [
  { id: "q1", type: "multiple_choice", content: "Hàm số f(x) = x² + 2x + 1 liên tục trên R?", options: ["Đúng với mọi x ∈ R", "Chỉ đúng tại x = 0", "Chỉ đúng với x > 0", "Sai"], correctAnswer: "Đúng với mọi x ∈ R", points: 1 },
  { id: "q2", type: "true_false", content: "Mọi đa thức đều liên tục trên R.", options: ["Đúng", "Sai"], correctAnswer: "Đúng", points: 1 },
  { id: "q3", type: "short_answer", content: "Đạo hàm của x² tại x = 2 bằng bao nhiêu?", correctAnswer: ["4", "4.0"], points: 1 }
];

export const rankings: AttemptRanking[] = [
  { id: "r1", name: "Minh", score: 20, maxScore: 20, durationSeconds: 202, rank: 1 },
  { id: "r2", name: "Long", score: 20, maxScore: 20, durationSeconds: 220, rank: 2 },
  { id: "r3", name: "Nam", score: 20, maxScore: 20, durationSeconds: 301, rank: 3 },
  { id: "r4", name: "Nguyễn Văn A", score: 19, maxScore: 20, durationSeconds: 194, rank: 4 },
  { id: "r5", name: "Nguyễn Thị B", score: 19, maxScore: 20, durationSeconds: 211, rank: 5 },
  { id: "r12", name: "Bạn", score: 18, maxScore: 20, durationSeconds: 383, rank: 12, isCurrent: true },
  { id: "r13", name: "Trần Văn C", score: 18, maxScore: 20, durationSeconds: 405, rank: 13 },
  { id: "r14", name: "Lê Thị D", score: 17, maxScore: 20, durationSeconds: 312, rank: 14 }
];
