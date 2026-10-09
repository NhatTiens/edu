import Link from "next/link";
import { Play, Trophy } from "lucide-react";

export function ResultCard() {
  return (
    <div className="stack">
      <div className="surface result-hero">
        <Trophy size={42} color="#f59e0b" style={{margin:"0 auto 8px"}}/>
        <h2>Hoàn thành bài kiểm tra!</h2>
        <div className="score-box">18 / 20 <small style={{fontSize:14, color:"var(--green)"}}>90%</small></div>
        <div className="result-stats"><div className="result-stat"><div className="small muted">Xếp hạng</div><strong>#12 / 235</strong></div><div className="result-stat"><div className="small muted">Thời gian</div><strong>06 phút 23 giây</strong></div><div className="result-stat"><div className="small muted">Số câu đúng</div><strong>18 câu</strong></div></div>
      </div>
      <div className="surface" style={{padding:20}}>
        <h3>Bài giải chi tiết</h3>
        <div className="video-placeholder"><Play size={64} fill="currentColor"/></div>
        <div className="row" style={{marginTop:14, flexWrap:"wrap"}}><a className="btn btn-orange" href="#">Tải tài liệu PDF</a><a className="btn btn-primary" href="https://facebook.com/" target="_blank" rel="noreferrer">Tham gia nhóm Facebook</a><Link className="btn btn-outline" href="/">Xem khóa học</Link></div>
      </div>
    </div>
  );
}
