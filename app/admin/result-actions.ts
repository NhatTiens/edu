"use server";
import { cmsClient } from '@/lib/repositories/cms';
import { resultDocumentSchema,youtubeEmbed,externalUrl } from '@/lib/result-blocks';
import { getResultDocument } from '@/lib/repositories/result-builder';
import { revalidatePath } from 'next/cache';
export async function saveResultDocument(input:unknown){try{
 const client=await cmsClient();const parsed=resultDocumentSchema.safeParse(input);if(!parsed.success)return {ok:false,message:parsed.error.issues.map(e=>`${e.path.join('.')}: ${e.message}`).join('\n')};
 const doc=parsed.data;doc.blocks=doc.blocks.map(b=>({...b,url:b.type==='text'?'':b.type==='youtube'?youtubeEmbed(b.url)!:externalUrl(b.url)!,scheduled_at:b.visibility==='scheduled_at'?new Date(b.scheduled_at).toISOString():''}));
 const {error}=await client.rpc('admin_save_result',{p_document:JSON.stringify(doc)});if(error)return {ok:false,message:error.message.includes('STALE_VERSION')?'Trang đã thay đổi ở phiên khác. Tải lại trước khi lưu.':'Không lưu được. Kiểm tra dữ liệu và kết nối.'};
 revalidatePath('/q','layout');revalidatePath(`/admin/quizzes/${doc.quiz_id}/result-page`);
 return {ok:true,message:'Đã lưu trang kết quả.',document:await getResultDocument(doc.quiz_id)};
 }catch{return {ok:false,message:'Không thể lưu. Kiểm tra phiên quản trị và kết nối.'};}}
