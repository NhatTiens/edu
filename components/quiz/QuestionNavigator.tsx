export function QuestionNavigator({ current = 7, total = 20 }: { current?: number; total?: number }) {
  return (
    <aside className="surface question-nav">
      <strong>Danh sách câu hỏi</strong>
      <div className="question-grid">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => <button key={n} className={`qnum ${n < current ? "done" : ""} ${n === current ? "current" : ""}`}>{n}</button>)}
      </div>
      <div className="stack small" style={{marginTop:18, gap:9}}>
        <span>⬜ Chưa trả lời</span><span style={{color:"var(--blue)"}}>■ Đã trả lời</span><span style={{color:"var(--orange)"}}>■ Câu hiện tại</span><span>🔖 Đánh dấu xem lại</span>
      </div>
    </aside>
  );
}
