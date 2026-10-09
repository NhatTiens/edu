import { notFound } from 'next/navigation';
import { getAdminQuiz } from '@/lib/repositories/admin-quiz';
import { QuizEditor } from '@/components/admin/QuizEditor';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const quiz=await getAdminQuiz(id);if(!quiz)notFound();return <QuizEditor initial={quiz} tab="questions"/>;}
