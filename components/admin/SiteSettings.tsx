"use client";
import { useState,useTransition } from 'react';
import { saveSiteSettings } from '@/app/admin/settings-actions';
import type { PresentationDocument } from '@/lib/site-presentation';
export function SiteSettings({initial}:{initial:PresentationDocument}){
 const [doc,setDoc]=useState(initial),[notice,setNotice]=useState<{ok:boolean;message:string}>(),[pending,start]=useTransition();
 return <form className="stack" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);const element=e.currentTarget;form.set('revision',doc.revision);start(async()=>{try{const result=await saveSiteSettings(form);setNotice(result);if(result.ok&&result.document){setDoc(result.document);element.querySelectorAll<HTMLInputElement>('input[type=file]').forEach(input=>{input.value='';});}}catch{setNotice({ok:false,message:'Mất kết nối. Vui lòng thử lại.'});}});}}>
 <fieldset disabled={pending} className="cms-fieldset grid-2">
 <section className="admin-card stack"><h2>Thương hiệu</h2><label className="label">Tên website<input name="name" className="input" required maxLength={100} defaultValue={doc.value.name}/></label>
 <label className="label">Logo<input className="input" name="logo_file" type="file" accept="image/png,image/jpeg,image/webp"/></label><input type="hidden" name="logo" value={doc.value.logo}/>{doc.value.logo&&<p className="small">Đã có logo. Chọn ảnh mới để thay.</p>}
 <label className="label">Facebook<input className="input" name="facebook" type="url" defaultValue={doc.value.facebook}/></label><label className="label">Zalo<input className="input" name="zalo" type="url" defaultValue={doc.value.zalo}/></label></section>
 <section className="admin-card stack"><h2>SEO cơ bản</h2><label className="label">Tiêu đề website<input className="input" name="title" required maxLength={200} defaultValue={doc.value.title}/></label><label className="label">Mô tả website<textarea className="textarea" name="description" maxLength={500} defaultValue={doc.value.description}/></label><label className="label">Ảnh social<input name="social_image_file" className="input" type="file" accept="image/png,image/jpeg,image/webp"/></label><input type="hidden" name="social_image" value={doc.value.social_image}/></section>
 <button className="btn btn-primary" type="submit">{pending?'Đang lưu…':'Lưu cài đặt'}</button></fieldset>
 {notice&&<p role={notice.ok?'status':'alert'}>{notice.message}</p>}</form>;
}
