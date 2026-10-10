import type { AttemptRanking } from "@/lib/types";

function time(sec:number){ const m=Math.floor(sec/60); const s=sec%60; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }

export function Leaderboard({ rankings }: { rankings: AttemptRanking[] }) {
  const top = rankings.slice(0,3);
  return (
    <div className="surface" style={{padding:24}}>
      <div style={{textAlign:"center"}}><h1 style={{marginBottom:6}}>🏆 Bảng xếp hạng</h1><p className="muted">235 người đã hoàn thành</p></div>
      <div className="leader-podium">{top.map((item, i)=><div key={item.id} className={`podium-card ${i===0?"first":""}`}><div className="avatar">{item.name[0]}</div><strong>{i===0?"🥇 ":i===1?"🥈 ":"🥉 "}{item.name}</strong><div>{item.score}/{item.maxScore}</div><div className="small muted">{time(item.durationSeconds)}</div></div>)}</div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table><thead><tr><th>#</th><th>Họ và tên</th><th>Điểm</th><th>Thời gian</th></tr></thead><tbody>{rankings.slice(3).map(item=><tr key={item.id} style={item.isCurrent?{background:"#eef6ff", color:"var(--blue)", fontWeight:800}:undefined}><td>{item.rank}</td><td>{item.name}</td><td>{item.score}/{item.maxScore}</td><td>{time(item.durationSeconds)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
