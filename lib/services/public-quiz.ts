import 'server-only';
import { createHash,createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/admin';
import { verifyQuizPassword } from '@/lib/auth/quiz-password';
import { validateParticipant,type BuilderField } from '@/lib/quiz-builder';
import { normalizeIdentifier,type EntryData,type AttemptData,type ResultData,type LeaderboardRow } from '@/lib/public-quiz';
import { z } from 'zod';
export class QuizError extends Error { constructor(public code:string,public status=400){super(code);} }
const messages:Record<string,string>={NOT_FOUND:'Bài kiểm tra không tồn tại.',ACCESS_REQUIRED:'Vui lòng mở khóa bài kiểm tra.',WRONG_PASSWORD:'Mật khẩu chưa đúng.',RATE_LIMIT:'Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.',QUIZ_UNAVAILABLE:'Bài kiểm tra chưa mở hoặc đã đóng.',QUIZ_CHANGED:'Bài kiểm tra đã thay đổi. Vui lòng mở khóa lại.',ATTEMPT_LIMIT:'Bạn đã dùng hết số lượt làm.',ACTIVE_ATTEMPT:'Bạn còn bài đang làm ở một phiên khác.',ATTEMPT_NOT_FOUND:'Không tìm thấy bài làm thuộc phiên này.',INVALID_PARTICIPANT:'Thông tin người làm bài chưa hợp lệ.',INVALID_ANSWERS:'Đáp án không hợp lệ.',INVALID_OPTION:'Lựa chọn không hợp lệ.',INVALID_QUESTION:'Câu hỏi không thuộc bài làm.',ORIGIN:'Yêu cầu không hợp lệ.',UNAVAILABLE:'Dịch vụ tạm thời chưa sẵn sàng.',PAYLOAD_TOO_LARGE:'Dữ liệu quá lớn.'};
export function errorMessage(code:string){return messages[code]??'Không thể xử lý yêu cầu. Vui lòng thử lại.';}
function secret(){const value=process.env.QUIZ_SESSION_SECRET;if(!value||value.length<32)throw new QuizError('UNAVAILABLE',503);return value;}
function digest(value:string){return createHash('sha256').update(value).digest('hex');}
function keyed(value:string){return createHmac('sha256',secret()).update(value).digest('hex');}
const cookiePrefix=()=>cookieOptions().secure?'__Host-':'';
const cookieName=(slug:string)=>cookiePrefix()+'quiz_access_'+digest(slug).slice(0,20);
function cookieOptions(){return {httpOnly:true,secure:process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')??process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/',maxAge:30*86400};}
export async function runtime<T>(op:string,payload:Record<string,unknown>):Promise<T>{
 try{const {data,error}=await createServiceClient().rpc('quiz_runtime',{p_op:op,p_payload:JSON.stringify(payload)});
 if(error){const code=Object.keys(messages).find(code=>error.message===code);throw new QuizError(code??'UNAVAILABLE',code==='NOT_FOUND'||code==='ATTEMPT_NOT_FOUND'?404:code==='ACCESS_REQUIRED'?401:code?400:503);}return JSON.parse(data) as T;
 }catch(e){if(e instanceof QuizError)throw e;throw new QuizError('UNAVAILABLE',503);}
}
type InternalMeta={id:string;slug:string;title:string;description:string;state:EntryData['state'];revision:string;password_hash:string|null;duration_minutes:number|null;attempt_limit:number|null;open_at:string|null;close_at:string|null;fields:BuilderField[]};
async function inspect(slug:string){if(!/^[a-z0-9-]{1,160}$/.test(slug))throw new QuizError('NOT_FOUND',404);return runtime<InternalMeta>('inspect',{slug});}
async function tokenHash(slug:string){const token=(await cookies()).get(cookieName(slug))?.value;return token&&/^[a-f0-9]{64}$/.test(token)?digest(token):'';}
async function visitor(){const store=await cookies();const name=cookiePrefix()+'quiz_visitor';const old=store.get(name)?.value??'';const [id,signature]=old.split('.');if(id&&/^[a-f0-9]{64}$/.test(id)&&signature&&/^[a-f0-9]{64}$/.test(signature)&&timingSafeEqual(Buffer.from(signature),Buffer.from(keyed(id))))return keyed('visitor:'+id);
 const next=randomBytes(32).toString('hex');store.set(name,`${next}.${keyed(next)}`,{...cookieOptions(),maxAge:365*86400});return keyed('visitor:'+next);
}
export async function entry(slug:string):Promise<EntryData>{
 const meta=await inspect(slug);const token_hash=await tokenHash(slug);const access=token_hash?await runtime<{ok:boolean}>('access',{slug,token_hash}):{ok:false};
 const fields=(access.ok||!meta.password_hash)&&meta.state==='published'?meta.fields.map(({id,label,key,type,placeholder,required,options})=>({id,label,key,type,placeholder,required,options})):[];
 return {slug,title:meta.state==='draft'?'Bài kiểm tra chưa được xuất bản':meta.title,description:meta.state==='draft'?'':meta.description??'',state:meta.state,hasPassword:!!meta.password_hash,unlocked:access.ok,duration_minutes:meta.duration_minutes,attempt_limit:meta.attempt_limit,open_at:meta.open_at,close_at:meta.close_at,fields};
}
export async function unlock(slug:string,password:string){
 const visitor_digest=await visitor();
 const limit=await runtime<{allowed:boolean}>('rate',{slug,visitor:visitor_digest});if(!limit.allowed)throw new QuizError('RATE_LIMIT',429);
 const meta=await inspect(slug);if(meta.state!=='published')throw new QuizError('QUIZ_UNAVAILABLE');
 if(meta.password_hash&&!await verifyQuizPassword(password,meta.password_hash))throw new QuizError('WRONG_PASSWORD',401);
 const current=await tokenHash(slug);if(current&&(await runtime<{ok:boolean}>('access',{slug,token_hash:current})).ok)return {ok:true};
 const existing=(await cookies()).get(cookieName(slug))?.value;const token=existing&&/^[a-f0-9]{64}$/.test(existing)?existing:randomBytes(32).toString('hex');await runtime('unlock',{slug,revision:meta.revision,token_hash:digest(token),visitor:visitor_digest});
 (await cookies()).set(cookieName(slug),token,cookieOptions());return {ok:true};
}
export async function start(slug:string,participant:Record<string,unknown>,request_id:string){
 const meta=await inspect(slug);if(meta.state!=='published')throw new QuizError('QUIZ_UNAVAILABLE');
 let token_hash=await tokenHash(slug);
 if(!meta.password_hash&&(!token_hash||!(await runtime<{ok:boolean}>('access',{slug,token_hash})).ok)){await unlock(slug,'');token_hash=await tokenHash(slug);}
 if(!token_hash)throw new QuizError('ACCESS_REQUIRED',401);
 const normalized:Record<string,unknown>={};for(const f of meta.fields){const v=participant[f.key];if(v!==undefined)normalized[f.key]=typeof v==='string'?v.normalize('NFC').trim():v;}
 if(Object.keys(validateParticipant(meta.fields,normalized)).length)throw new QuizError('INVALID_PARTICIPANT');
 const identifier=meta.fields.find(f=>f.is_identifier);const visitor_digest=await visitor();
 const identity=identifier?keyed(meta.id+':identifier:'+normalizeIdentifier(String(normalized[identifier.key]),identifier.type)):keyed(meta.id+':browser:'+visitor_digest);
 return runtime<{id:string}>('start',{slug,token_hash,revision:meta.revision,identity,request_id,participant:normalized});
}
export async function ownedAttempt(slug:string,id:string,op:'get'|'result'='get'){
 if(!z.uuid().safeParse(id).success)throw new QuizError('ATTEMPT_NOT_FOUND',404);
 return runtime<AttemptData&Partial<ResultData>>(op,{slug,attempt_id:id,token_hash:await tokenHash(slug)});
}
export async function writeAttempt(slug:string,op:'save'|'submit',id:string,answers:Record<string,string|boolean|null>){return runtime<AttemptData>(op,{slug,attempt_id:id,answers,token_hash:await tokenHash(slug)});}
export async function leaderboard(slug:string){return runtime<LeaderboardRow[]>('leaderboard',{slug,token_hash:await tokenHash(slug)});}

