"use server";
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cmsClient } from '@/lib/repositories/cms';
import { presentationSchema, type PresentationDocument } from '@/lib/site-presentation';
import { sanitizeImage } from '@/lib/services/image-upload';
export async function saveSiteSettings(form:FormData){
 const uploaded:string[]=[];const client=await cmsClient().catch(()=>null);if(!client)return {ok:false,message:'Phiên quản trị hết hạn.'};
 try{
  const values=Object.fromEntries(['name','logo','facebook','zalo','title','description','social_image'].map(k=>[k,String(form.get(k)??'')]));
  for(const key of ['logo','social_image']){const file=form.get(key+'_file');if(file instanceof File&&file.size){const bytes=await sanitizeImage(file);const path=randomUUID()+'.webp';const {error}=await client.storage.from('site-assets').upload(path,bytes,{contentType:'image/webp',upsert:false});if(error)throw new Error('Không tải được ảnh.');uploaded.push(path);values[key]=client.storage.from('site-assets').getPublicUrl(path).data.publicUrl;}}
  const parsed=presentationSchema.safeParse(values);if(!parsed.success)throw new Error('Kiểm tra tên, tiêu đề, độ dài và URL cài đặt.');
  const {data,error}=await client.rpc('admin_site_presentation',{p_value:JSON.stringify(parsed.data),p_revision:String(form.get('revision')??'')});
  if(error)throw new Error(error.message.includes('STALE_VERSION')?'Cài đặt đã thay đổi. Tải lại trang trước khi sửa.':'Không lưu được cài đặt.');
  revalidatePath('/','layout');return {ok:true,message:'Đã lưu cài đặt.',document:JSON.parse(data) as PresentationDocument};
 }catch(e){if(uploaded.length)await client.storage.from('site-assets').remove(uploaded);return {ok:false,message:e instanceof Error?e.message:'Không lưu được cài đặt.'};}
}
