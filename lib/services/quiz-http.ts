import { NextRequest,NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/auth/site-origin';
import { z } from 'zod';
import { QuizError,errorMessage,unlock,start,writeAttempt,ownedAttempt } from '@/lib/services/public-quiz';
const answerSchema=z.object({attemptId:z.uuid(),answers:z.record(z.uuid(),z.union([z.string().max(2000),z.boolean(),z.null()]))}).strict();
const startSchema=z.object({requestId:z.uuid(),participant:z.record(z.string().max(64),z.union([z.string().max(10000),z.array(z.string().max(500)).max(100)]))}).strict();
const unlockSchema=z.object({password:z.string().max(128)}).strict();
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
async function readBody(req:NextRequest){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new QuizError('INVALID_ANSWERS');
 const reader=req.body?.getReader();if(!reader)throw new QuizError('INVALID_ANSWERS');const chunks:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>128000){await reader.cancel();throw new QuizError('PAYLOAD_TOO_LARGE',413);}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new QuizError('INVALID_ANSWERS');}
}
export async function handleQuiz(req:NextRequest,slug:string,op:'unlock'|'start'|'save'|'submit'|'get'){
 try{
 if(!/^[a-z0-9-]{1,160}$/.test(slug))throw new QuizError('NOT_FOUND',404);
 if(op==='get'){const id=req.nextUrl.searchParams.get('attemptId')??'';return NextResponse.json(await ownedAttempt(slug,id),{headers});}
 const expected=siteOrigin();if(req.headers.get('origin')!==expected)throw new QuizError('ORIGIN',403);
 const body=await readBody(req);let result;
 if(op==='unlock'){const parsed=unlockSchema.safeParse(body);if(!parsed.success)throw new QuizError('WRONG_PASSWORD');result=await unlock(slug,parsed.data.password);}
 else if(op==='start'){const parsed=startSchema.safeParse(body);if(!parsed.success)throw new QuizError('INVALID_PARTICIPANT');result=await start(slug,parsed.data.participant,parsed.data.requestId);}
 else{const parsed=answerSchema.safeParse(body);if(!parsed.success)throw new QuizError('INVALID_ANSWERS');result=await writeAttempt(slug,op,parsed.data.attemptId,parsed.data.answers);}
 return NextResponse.json(result,{headers});
 }catch(e){const err=e instanceof QuizError?e:new QuizError('UNAVAILABLE',503);return NextResponse.json({error:err.code,message:errorMessage(err.code)},{status:err.status,headers:{...headers,...(err.status===429?{'Retry-After':'900'}:{})}});}
}

