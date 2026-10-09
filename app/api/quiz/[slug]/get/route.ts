import { NextRequest } from 'next/server';
import { handleQuiz } from '@/lib/services/quiz-http';
export const runtime='nodejs';
export async function GET(request:NextRequest,{params}:{params:Promise<{slug:string}>}){return handleQuiz(request,(await params).slug,'get');}
