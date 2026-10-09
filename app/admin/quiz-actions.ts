"use server";
import { builderSchema,normalizeShortAnswer } from '@/lib/quiz-builder';
import { cmsClient } from '@/lib/repositories/cms';
import { hashQuizPassword } from '@/lib/auth/quiz-password';
import { getAdminQuiz } from '@/lib/repositories/admin-quiz';
import { revalidatePath } from 'next/cache';
export async function saveQuiz(input:unknown){
 try{
 const client=await cmsClient();const parsed=builderSchema.safeParse(input);
 if(!parsed.success)return {ok:false,message:parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('\n')};
 const {password,remove_password,has_password,...doc}=parsed.data;void has_password;
 const hash=password?await hashQuizPassword(password):null;
 doc.fields=doc.fields.map((f,i)=>({...f,sort_order:i}));doc.questions=doc.questions.map((q,i)=>({...q,sort_order:i,accepted_answers:q.accepted_answers.map(a=>normalizeShortAnswer(a,false))}));
 const {data,error}=await client.rpc('admin_save_quiz',{p_document:JSON.stringify(doc),p_password_hash:hash,p_remove_password:remove_password});
 if(error){const message=error.message.includes('STALE_VERSION')?'Quiz đã thay đổi ở phiên khác. Tải lại trước khi lưu.':error.message.includes('QUIZ_HAS_ATTEMPTS')?'Quiz đã có bài làm. Không thể sửa cho đến khi hỗ trợ snapshot; tạo quiz mới để bảo toàn kết quả.':error.code==='23505'?'Slug, key hoặc đáp án bị trùng.':'Không lưu được quiz. Kiểm tra kết nối, dữ liệu và migration.';return {ok:false,message};}
 revalidatePath('/admin/quizzes','layout');revalidatePath('/q','layout');
 return {ok:true,message:'Đã lưu quiz.',quiz:await getAdminQuiz(data)};
 }catch{return {ok:false,message:'Không thể lưu. Kiểm tra phiên quản trị và kết nối.'};}
}
