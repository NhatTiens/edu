import Link from "next/link";
export function ResultsNav({ id }: { id: string }) {
  return (
    <nav className="tabs" aria-label="Dữ liệu kết quả">
      <Link className="tab" href={`/admin/quizzes/${id}`}>
        Quiz
      </Link>
      {[
        ["participants", "Người tham gia"],
        ["leaderboard", "Xếp hạng"],
        ["analytics", "Phân tích"],
      ].map(([path, label]) => (
        <Link className="tab" key={path} href={`/admin/quizzes/${id}/${path}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
