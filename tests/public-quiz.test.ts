import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { runtimeDatabase } from './helpers/runtime-db';
import { normalizeIdentifier } from '../lib/public-quiz';
const slug='giai-tich-1-chuong-1-2';const quiz='20000000-0000-4000-8000-000000000001';
const q1='20000000-0000-4000-8000-000000000201',q2='20000000-0000-4000-8000-000000000202',q3='20000000-0000-4000-8000-000000000203';
const correctOption='20000000-0000-4000-8000-000000000301';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
test('identifier normalization handles Unicode, whitespace, case and numeric aliases',()=>{assert.equal(normalizeIdentifier('  NGUYỄN   A  ','text'),'nguyễn a');assert.equal(normalizeIdentifier('USER@Example.Com','email'),'user@example.com');assert.equal(normalizeIdentifier('0001.000','number'),'1');assert.equal(normalizeIdentifier('-00.0','number'),'0');});
test('runtime lifecycle: server duration, all grading types, limits, ownership, replay, snapshots and ranking',async()=>{
 const db=await runtimeDatabase();
 const rpc=async<T=Record<string,unknown>>(op:string,p:Record<string,unknown>={})=>JSON.parse((await db.query<{data:string}>('select public.quiz_runtime($1,$2) as data',[op,JSON.stringify({slug,...p})])).rows[0].data) as T;
 async function session(label:string){const token_hash=hash(label);const meta=await rpc('inspect');await rpc('unlock',{revision:meta.revision,visitor:hash('browser'+label),token_hash});return token_hash;}
 async function start(label:string,token_hash:string){const meta=await rpc('inspect');return rpc('start',{token_hash,revision:meta.revision,request_id:randomUUID(),identity:hash(label),participant:{name:label},started_at:'2000-01-01',score:999});}
 try{
 const token=await session('one');const {id}=await start('person',token);
 const a=await rpc('get',{token_hash:token,attempt_id:id});assert.equal(a.status,'in_progress');assert.equal((a.questions as unknown[]).length,3);assert.ok(Date.parse(a.started_at as string)>Date.now()-60000);
 const before=JSON.stringify(a);for(const field of ['correct_option_id','correct_boolean','accepted_answers','password_hash','case_insensitive','participant_data'])assert.ok(!before.includes(field));
 await assert.rejects(rpc('get',{token_hash:hash('wrong'),attempt_id:id}),/ACCESS_REQUIRED/);
 const another=await session('two');await assert.rejects(rpc('get',{token_hash:another,attempt_id:id}),/ATTEMPT_NOT_FOUND/);await assert.rejects(start('person',another),/ATTEMPT_LIMIT/);
 const replay=await start('person',token);assert.equal(replay.id,id);
 await assert.rejects(rpc('save',{token_hash:token,attempt_id:id,answers:{[randomUUID()]:'x'}}),/INVALID_QUESTION/);
 await assert.rejects(rpc('submit',{token_hash:token,attempt_id:id,answers:{[q1]:'not-an-option'}}),/INVALID_OPTION/);
 await rpc('save',{token_hash:token,attempt_id:id,answers:{[q1]:correctOption,[q2]:true}});
 const resumed=await rpc('get',{token_hash:token,attempt_id:id});assert.equal(resumed.started_at,a.started_at);assert.deepEqual(resumed.answers,{[q1]:correctOption,[q2]:true});
 // Source correctness changes cannot affect the captured attempt snapshot.
 await db.exec(`update public.question_options set is_correct=false where question_id='${q1}';update public.short_answer_accepted_answers set answer='changed' where question_id='${q3}';`);
 const payload={token_hash:token,attempt_id:id,answers:{[q1]:correctOption,[q2]:true,[q3]:' \t4.0\n '},submitted_at:'2000-01-01',duration_ms:0,score:999};
 await Promise.all([rpc('submit',payload),rpc('submit',payload)]);
 const result=await rpc('result',{token_hash:token,attempt_id:id});assert.equal(result.score,3);assert.equal(result.correct_count,3);assert.equal(result.wrong_count,0);assert.ok(!result.review);
 const stored=(await db.query<{duration_ms:number;delta:number;submitted_at:string}>('select duration_ms,floor(extract(epoch from(submitted_at-started_at))*1000) as delta,submitted_at from public.attempts where id=$1',[id])).rows[0];assert.equal(Number(stored.duration_ms),Number(stored.delta));assert.ok(Number(stored.delta)>=0);
 await rpc('submit',{...payload,answers:{[q3]:'wrong'}});assert.deepEqual(await rpc('result',{token_hash:token,attempt_id:id}),result);assert.equal((await db.query('select * from public.answers where attempt_id=$1',[id])).rows.length,3);
 // Atomic rate limit persists rejected hits.
 for(let i=0;i<8;i++)assert.equal((await rpc('rate',{visitor:'rate-client'})).allowed,true);assert.equal((await rpc('rate',{visitor:'rate-client'})).allowed,false);
 // Exact mandatory ranking and stable final UUID tie break.
 await db.exec(`insert into public.attempts(quiz_id,status,started_at,submitted_at,duration_ms,score,max_score,question_snapshot) values
 ('${quiz}','submitted',now()-interval '1 minute',now(),5000,2,3,'{"display_name":"lower"}'),
 ('${quiz}','submitted',now()-interval '1 minute',now(),100,3,3,'{"display_name":"fast"}'),
 ('${quiz}','submitted',now()-interval '1 minute',now()-interval '30 seconds',100,3,3,'{"display_name":"earlier"}');`);
 const board=await rpc<Array<{rank:number;score:number;duration_ms:number;name:string}>>('leaderboard',{token_hash:token});for(let i=1;i<board.length;i++){assert.ok(board[i-1].score>board[i].score||(board[i-1].score===board[i].score&&board[i-1].duration_ms<=board[i].duration_ms));}assert.ok(board.findIndex(r=>r.name==='earlier')<board.findIndex(r=>r.name==='fast'));assert.ok(!JSON.stringify(board).includes('participant_data'));assert.ok(!JSON.stringify(board).includes('token_hash'));
 await db.exec(`update public.quizzes set show_score=false,show_ranking=false where id='${quiz}'`);const hidden=await rpc('result',{token_hash:token,attempt_id:id});assert.equal(hidden.score,null);assert.equal(hidden.rank,null);assert.deepEqual(await rpc('leaderboard',{token_hash:token}),[]);
 }finally{await db.close();}
});
test('deadline rejects late answers, case sensitivity, state checks and RLS enforce no answer access',async()=>{
 const db=await runtimeDatabase();const rpc=async(op:string,p:Record<string,unknown>={})=>JSON.parse((await db.query<{data:string}>('select public.quiz_runtime($1,$2) as data',[op,JSON.stringify({slug,...p})])).rows[0].data);
 try{
 await assert.rejects(rpc('inspect',{slug:'missing'}),/NOT_FOUND/);
 for(const [sql,state] of [["status='draft'",'draft'],["status='published',open_at=now()+interval '1 day'",'scheduled'],["status='closed',open_at=null",'closed']]){await db.exec(`update public.quizzes set ${sql} where id='${quiz}'`);assert.equal((await rpc('inspect')).state,state);await assert.rejects(rpc('unlock',{token_hash:hash('t'),revision:(await rpc('inspect')).revision,visitor:'v'}),/QUIZ_UNAVAILABLE/);}
 await db.exec(`update public.quizzes set status='published',show_correct_answers=true,open_at=null where id='${quiz}';update public.questions set case_insensitive=false where id='${q3}';update public.short_answer_accepted_answers set answer='Hello',answer_normalized='Hello' where id='20000000-0000-4000-8000-000000000401';`);
 const token_hash=hash('session');const meta=await rpc('inspect');await rpc('unlock',{token_hash,revision:meta.revision,visitor:'v'});const {id}=await rpc('start',{token_hash,revision:meta.revision,request_id:randomUUID(),identity:hash('person'),participant:{name:'A'}});
 await rpc('save',{token_hash,attempt_id:id,answers:{[q3]:'hello',[q2]:false}});
 await db.exec(`update public.attempts set started_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' where id='${id}'`);
 await rpc('submit',{token_hash,attempt_id:id,answers:{[q1]:correctOption,[q2]:true,[q3]:'Hello'}});
 const result=await rpc('result',{token_hash,attempt_id:id});assert.equal(result.score,0);assert.equal(result.timed_out,true);assert.ok(Number(result.duration_ms)>=119000);assert.ok(!result.review);
 await db.exec(`update public.quizzes set status='closed' where id='${quiz}'`);assert.equal((await rpc('result',{token_hash,attempt_id:id})).review.length,3);
 await db.exec('set role anon');for(const t of ['published_quizzes','published_quiz_questions','published_question_options','quiz_access_sessions','quiz_rate_limits','questions','question_options','short_answer_accepted_answers','attempts','answers'])await assert.rejects(db.query(`select * from public.${t}`));await assert.rejects(rpc('inspect'));
 await db.exec('set role authenticated');await assert.rejects(rpc('inspect'));await assert.rejects(db.query('select public.quiz_finalize($1)',[id]));
 await db.exec('set role service_role');assert.equal((await rpc('inspect')).state,'closed');
 }finally{await db.close();}
});

test('two allowed attempts stay distinct while old start request IDs replay the original',async()=>{
 const db=await runtimeDatabase();const rpc=async(op:string,p:Record<string,unknown>={})=>JSON.parse((await db.query<{data:string}>('select public.quiz_runtime($1,$2) as data',[op,JSON.stringify({slug,...p})])).rows[0].data);
 try{
 await db.exec(`update public.quizzes set attempt_limit=2 where id='${quiz}'`);
 const meta=await rpc('inspect');const token_hash=hash('limit-two');await rpc('unlock',{token_hash,revision:meta.revision,visitor:'v'});
 const payload={token_hash,revision:meta.revision,identity:hash('two-person'),participant:{name:'Two'},request_id:randomUUID()};
 const first=await rpc('start',payload);await rpc('submit',{token_hash,attempt_id:first.id,answers:{}});
 const second=await rpc('start',{...payload,request_id:randomUUID()});assert.notEqual(second.id,first.id);assert.equal((await rpc('start',payload)).id,first.id);
 await rpc('submit',{token_hash,attempt_id:second.id,answers:{}});
 await assert.rejects(rpc('start',{...payload,request_id:randomUUID()}),/ATTEMPT_LIMIT/);
 assert.equal((await db.query('select * from public.attempts where quiz_id=$1',[quiz])).rows.length,2);
 }finally{await db.close();}
});
