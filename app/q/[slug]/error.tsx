"use client";
export default function Error({reset}:{reset:()=>void}){return <main className="quiz-center"><section className="surface form-card"><h1>Chưa thể tải bài kiểm tra</h1><p>Vui lòng thử lại sau. Bài đang làm vẫn giữ thời gian và đáp án đã lưu.</p><button className="btn btn-primary" onClick={reset}>Thử lại</button></section></main>}
