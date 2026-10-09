"use client";

import { useState } from "react";

const options = ["Đúng với mọi x ∈ R", "Chỉ đúng tại x = 0", "Chỉ đúng với x > 0", "Sai"];

export function QuestionPanel() {
  const [selected, setSelected] = useState(1);
  return (
    <section className="surface question-panel">
      <div className="row-between"><strong style={{color:"var(--blue)"}}>Câu 7 / 20</strong><label className="small row"><input type="checkbox"/> Đánh dấu xem lại</label></div>
      <h2 style={{fontSize:18, marginTop:24}}>Hàm số f(x) = x² + 2x + 1 liên tục trên R?</h2>
      <div style={{marginTop:20}}>
        {options.map((opt, i) => <button onClick={()=>setSelected(i)} className={`option ${selected===i?"selected":""}`} style={{width:"100%", textAlign:"left"}} key={opt}><span className="radio-dot">{String.fromCharCode(65+i)}</span><span>{opt}</span></button>)}
      </div>
      <div className="row-between" style={{marginTop:60}}><button className="btn btn-outline">← Câu trước</button><button className="btn btn-primary">Câu sau →</button></div>
    </section>
  );
}
