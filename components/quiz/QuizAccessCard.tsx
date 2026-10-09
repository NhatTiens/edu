import Link from "next/link";
import { FileText } from "lucide-react";
import type { Quiz } from "@/lib/types";

export function QuizAccessCard({ quiz }: { quiz: Quiz }) {
  return (
    <div className="surface quiz-card stack">
      <div className="quiz-icon"><FileText size={30}/></div>
      <div>
        <h1 style={{margin:0, fontSize:26}}>{quiz.title}</h1>
        <div className="quiz-meta"><span>{quiz.questionCount} câu hỏi</span><span>•</span><span>{quiz.durationMinutes} phút</span><span>•</span><span>{quiz.attemptLimit} lượt làm</span></div>
      </div>
      <input className="input" type="password" placeholder="Nhập mật khẩu" />
      <Link className="btn btn-primary" href={`/q/${quiz.slug}/info`}>Vào bài</Link>
      <div style={{background:"#eff7ff", padding:14, borderRadius:10}} className="small muted">Bài kiểm tra sẽ đóng lúc <strong>22:00 • 12/10/2026</strong></div>
    </div>
  );
}
