/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { mutateCms } from '@/app/admin/cms-actions';
import { IMAGE_LIMIT, IMAGE_TYPES, type CmsKind, type CmsRecord, type CmsResult } from '@/lib/cms';
export function CmsForm({kind,record,sections=[]}:{kind:CmsKind;record?:CmsRecord;sections?:CmsRecord[]}) {
 const router=useRouter(); const [pending,start]=useTransition(); const [notice,setNotice]=useState<CmsResult>(); const [file,setFile]=useState<File>(); const [blob,setBlob]=useState('');
 const [saved,setSaved]=useState(record); const value=(key:string,fallback='')=>String(saved?.[key] ?? fallback);
 useEffect(()=>{if(!file)return; const url=URL.createObjectURL(file); setBlob(url); return ()=>URL.revokeObjectURL(url);},[file]);
 const path=kind==='sections'?'course-sections':kind;
 const input=(name:string,label:string,type='text',required=false,fallback='')=><label className="label" key={name}>{label}<input name={name} className="input" type={type} required={required} min={type==='number'?0:undefined} max={type==='number'?2147483647:undefined} maxLength={2000} defaultValue={value(name,fallback)}/></label>;
 return <form className="stack" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);if(saved){data.set('id',saved.id);data.set('updated_at',saved.updated_at);}start(async()=>{try{const result=await mutateCms(kind,'save',data);setNotice(result);if(result.ok){setSaved({...saved,id:result.id!,updated_at:result.updated_at!} as CmsRecord);router.refresh();}}catch{setNotice({ok:false,message:'Mất kết nối. Thử lại.'});}});}}>
 <fieldset disabled={pending} className="cms-fieldset stack">
 {input('title','Tiêu đề','text',true)}
 <label className="label">Mô tả<textarea name="description" className="textarea" maxLength={10000} defaultValue={value('description')}/></label>
 {kind!=='sections'&&<><label className="label">Ảnh (JPEG, PNG, WebP; tối đa 5 MB)<input className="input" name="image" type="file" accept={IMAGE_TYPES.join(',')} onChange={e=>{const f=e.target.files?.[0];if(f&&(f.size>IMAGE_LIMIT||!IMAGE_TYPES.includes(f.type))){e.target.value='';setNotice({ok:false,message:'Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB.'});setFile(undefined);setBlob('');return;}setFile(f);if(!f)setBlob('');}}/></label>{(blob||value(kind==='banners'?'image_url':'thumbnail_url'))&&<img className="cms-preview" src={blob||value(kind==='banners'?'image_url':'thumbnail_url')} alt="Xem trước ảnh"/>}<label className="row"><input type="checkbox" name="remove_image"/> Gỡ ảnh hiện tại</label></>}
 {kind==='banners'&&<><div className="form-grid">{input('button_text','Nội dung nút')}{input('target_url','URL đích (/path hoặc https://...)')}</div><label className="row"><input type="checkbox" name="open_new_tab" defaultChecked={saved?.open_new_tab!==false}/> Mở trong tab mới</label></>}
 {kind==='courses'&&<><div className="form-grid">{input('slug','Slug','text',true)}{input('category','Danh mục')}{input('price','Giá','number',true,'0')}{input('old_price','Giá cũ','number')}{input('badge','Badge')}<label className="label">Nhóm<select className="select" name="section_id" defaultValue={value('section_id')}><option value="">Không nhóm</option>{sections.map(s=><option key={s.id} value={s.id}>{s.title}{s.status==='archived'?' (lưu trữ)':''}</option>)}</select></label>{input('teacher_name','Tên giảng viên')}{input('teacher_link','Link giảng viên','url')}{input('course_link','Link khóa học (/path hoặc https://...)')}<label className="label">Màu<select className="select" name="theme" defaultValue={value('theme','orange')}>{['orange','blue','green','cyan'].map(t=><option key={t}>{t}</option>)}</select></label></div></>}
 {input('sort_order','Thứ tự (số nhỏ xuất hiện trước)','number',true,'0')}
 <label className="row"><input name="is_published" type="checkbox" defaultChecked={saved?.is_published??false}/> Hiển thị trên homepage</label>
 <div className="row cms-actions"><button className="btn btn-primary">{pending?'Đang lưu...':'Lưu thay đổi'}</button><Link className="btn btn-outline" href={`/admin/${path}`}>Về danh sách</Link></div>
 </fieldset>
 {notice&&<div className={`cms-toast ${notice.ok?'success':'error'}`} role={notice.ok?'status':'alert'}>{notice.message}<button type="button" aria-label="Đóng thông báo" onClick={()=>setNotice(undefined)}>×</button></div>}
 </form>;
}

