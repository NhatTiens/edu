"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { mutateCms } from '@/app/admin/cms-actions';
import type { CmsKind, CmsRecord, CmsResult } from '@/lib/cms';
export function CmsList({kind,records}:{kind:CmsKind;records:CmsRecord[]}){
 const [query,setQuery]=useState('');const [filter,setFilter]=useState('all');const [notice,setNotice]=useState<CmsResult>();const [pending,start]=useTransition();const router=useRouter();const path=kind==='sections'?'course-sections':kind;
 const rows=records.filter(r=>r.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())&&(filter==='all'||r.status===filter));
 function change(r:CmsRecord,op:string){if(op==='archive'&&!window.confirm(`Lưu trữ “${r.title}”? Nội dung sẽ bị ẩn; dữ liệu và ảnh vẫn được giữ để khôi phục.`))return;const f=new FormData();f.set('id',r.id);f.set('updated_at',r.updated_at);start(async()=>{try{const result=await mutateCms(kind,op,f);setNotice(result);if(result.ok)router.refresh();}catch{setNotice({ok:false,message:'Mất kết nối. Thử lại.'});}});}
 return <section className="admin-card"><div className="row cms-actions"><input aria-label="Tìm nội dung" className="input" placeholder="Tìm kiếm..." value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Lọc trạng thái" className="select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="published">Hiển thị</option><option value="draft">Ẩn</option><option value="archived">Lưu trữ</option></select></div>
 {!rows.length?<p className="muted">Chưa có nội dung phù hợp. Thêm mới hoặc đổi bộ lọc.</p>:<div className="table-wrap" tabIndex={0} aria-label="Danh sách nội dung"><table><thead><tr><th>Tiêu đề</th><th>Thứ tự</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.title}</strong></td><td>{r.sort_order}</td><td><span className={`status ${r.is_published?'':'draft'}`}>{r.status==='archived'?'Lưu trữ':r.is_published?'Hiển thị':'Ẩn'}</span></td><td><div className="row"><Link className="btn btn-soft" href={`/admin/${path}/${r.id}`}>Sửa / thứ tự</Link><button disabled={pending} className="btn btn-outline" onClick={()=>change(r,r.is_published?'hide':'publish')}>{r.is_published?'Ẩn':'Hiện'}</button>{r.status!=='archived'&&<button disabled={pending} className="btn btn-ghost" onClick={()=>change(r,'archive')}>Lưu trữ</button>}</div></td></tr>)}</tbody></table></div>}
 {notice&&<div className={`cms-toast ${notice.ok?'success':'error'}`} role={notice.ok?'status':'alert'}>{notice.message}<button aria-label="Đóng thông báo" onClick={()=>setNotice(undefined)}>×</button></div>}</section>;
}
