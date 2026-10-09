import 'server-only';
import { cmsClient } from '@/lib/repositories/cms';
import { builderSchema, type QuizBuilderData } from '@/lib/quiz-builder';
export async function listAdminQuizzes(){const client=await cmsClient();const {data,error}=await client.from('quizzes').select('id,title,slug,status,updated_at').order('updated_at',{ascending:false});if(error)throw new Error('Không thể tải quiz. Kiểm tra migration và kết nối.');return data;}
export async function getAdminQuiz(id:string):Promise<QuizBuilderData|null>{if(!/^[a-f0-9-]{36}$/i.test(id))return null;const client=await cmsClient();const {data,error}=await client.rpc('admin_quiz_document',{p_id:id});if(error)throw new Error('Không thể tải quiz. Kiểm tra migration 0005.');return data?builderSchema.parse(JSON.parse(data)):null;}
