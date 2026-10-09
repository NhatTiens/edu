"use client";
import { useState,useRef } from 'react';
import { useRouter } from 'next/navigation';
import { validateParticipant } from '@/lib/participant';
import type { EntryData } from '@/lib/public-quiz';
export async function quizPost(slug:string,op:string,body:unknown){const response=await fetch(`/api/quiz/${encodeURIComponent(slug)}/${op}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.message??'Không thể xử lý yêu cầu.');return data;}
export function QuizEntry({quiz}:{quiz:EntryData}){
 const router=useRouter();
 const [password,setPassword]=useState('');const [pending,setPending]=useState(false);const [error,setError]=useState('');const requestId=useRef('');
 const messages={draft:'Bài kiểm tra chưa được xuất bản.',scheduled:'Bài kiểm tra chưa đến giờ mở.',closed:'Bài kiểm tra đã đóng.',published:''};
 if(quiz.state!=='published')return <main className="quiz-center"><section className="surface quiz-card"><h1>{quiz.title}</h1><p role="status">{messages[quiz.state]}</p>{quiz.state==='scheduled'&&quiz.open_at&&<p>Mở lúc {new Date(quiz.open_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (giờ Việt Nam)</p>}</section></main>;
 const locked=quiz.hasPassword&&!quiz.unlocked;
 return <main className="quiz-center"><section className="surface form-card stack"><h1>{quiz.title}</h1><p className="muted">{quiz.description}</p><div className="quiz-meta"><span>{quiz.duration_minutes?`${quiz.duration_minutes} phút`:'Không giới hạn thời gian'}</span><span>{quiz.attempt_limit?`${quiz.attempt_limit} lượt làm`:'Không giới hạn lượt làm'}</span></div>
 <form method="post" className="stack" onSubmit={async e=>{e.preventDefault();if(pending)return;const form=new FormData(e.currentTarget);setPending(true);setError('');try{if(locked){await quizPost(quiz.slug,'unlock',{password});router.refresh();setPending(false);}else{const participant:Record<string,unknown>={};for(const f of quiz.fields)participant[f.key]=f.type==='checkbox'?form.getAll(f.key):String(form.get(f.key)??'');const errors=validateParticipant(quiz.fields,participant);if(Object.keys(errors).length)throw new Error(Object.entries(errors).map(([key,message])=>key+": "+message).join(' '));if(!requestId.current)requestId.current=crypto.randomUUID();const {id}=await quizPost(quiz.slug,'start',{participant,requestId:requestId.current});router.push(`/q/${quiz.slug}/attempt/${id}`);}}catch(e){setError(e instanceof Error?e.message:'Mất kết nối, vui lòng thử lại.');setPending(false);}}}>
 <fieldset disabled={pending} className="cms-fieldset stack">{locked?<label className="label">Mật khẩu bài kiểm tra<input className="input" type="password" autoComplete="off" value={password} maxLength={128} onChange={e=>setPassword(e.target.value)} required/></label>:<><h2>Thông tin người làm bài</h2>{quiz.fields.map(f=><div key={f.id}><label className="label" htmlFor={f.id}>{f.label}{f.required?' *':''}</label>{f.type==='textarea'?<textarea id={f.id} name={f.key} required={f.required} maxLength={10000} placeholder={f.placeholder} className="textarea"/>:f.type==='select'?<select id={f.id} name={f.key} required={f.required} className="select" defaultValue=""><option value="">Chọn...</option>{f.options.map(o=><option key={o}>{o}</option>)}</select>:['radio','checkbox'].includes(f.type)?<fieldset className="cms-fieldset stack"><legend className="small">{f.label}</legend>{f.options.map(o=><label className="row" key={o}><input type={f.type} name={f.key} value={o} required={f.required&&f.type==='radio'}/>{o}</label>)}</fieldset>:<input id={f.id} className="input" type={f.type} step={f.type==='number'?'any':undefined} name={f.key} maxLength={10000} required={f.required} placeholder={f.placeholder}/>}</div>)}<p className="small muted">Thời gian bắt đầu tính khi nhấn Bắt đầu. Tải lại trang sẽ tiếp tục bài đang làm. Đáp án được lưu tự động khi có kết nối.</p></>}
 <button className="btn btn-primary">{pending?'Đang xử lý…':locked?'Mở khóa':'Bắt đầu làm bài'}</button></fieldset>{error&&<p role="alert" style={{color:'var(--red)'}}>{error}</p>}</form>
 </section></main>;
}




