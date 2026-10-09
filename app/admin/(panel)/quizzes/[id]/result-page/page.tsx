import { QuizTabs } from '@/components/admin/QuizTabs';
import { ResultBuilder } from '@/components/admin/ResultBuilder';
import { getResultDocument } from '@/lib/repositories/result-builder';
import { notFound } from 'next/navigation';
export default async function Page({params}:{params:Promise<{id:string}>}){const doc=await getResultDocument((await params).id);if(!doc)notFound();return <><h1 className="admin-page-title">Trang sau khi nộp</h1><QuizTabs id={doc.quiz_id} active="result"/><ResultBuilder initial={doc}/></>}
