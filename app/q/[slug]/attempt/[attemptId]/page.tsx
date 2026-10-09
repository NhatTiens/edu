import { ownedAttempt,QuizError } from '@/lib/services/public-quiz';
import { notFound,redirect } from 'next/navigation';
import { AttemptRunner } from '@/components/quiz/AttemptRunner';
export default async function Page({params}:{params:Promise<{slug:string;attemptId:string}>}){const {slug,attemptId}=await params;let data;try{data=await ownedAttempt(slug,attemptId);}catch(e){if(e instanceof QuizError&&e.status===404)notFound();if(e instanceof QuizError&&e.status===401)redirect(`/q/${slug}`);throw e;}if(data.status==='submitted')redirect(`/q/${slug}/result/${attemptId}`);return <AttemptRunner slug={slug} initial={data}/>;}
