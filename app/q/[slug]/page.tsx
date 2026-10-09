import { entry,QuizError,errorMessage } from '@/lib/services/public-quiz';
import { QuizEntry } from '@/components/quiz/QuizEntry';
import { notFound } from 'next/navigation';
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;let data;try{data=await entry(slug);}catch(e){if(e instanceof QuizError&&e.status===404)notFound();throw new Error(errorMessage('UNAVAILABLE'));}return <QuizEntry quiz={data}/>;}
