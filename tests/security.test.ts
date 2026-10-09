import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {runtimeDatabase} from './helpers/runtime-db';
import {safeHttpUrl} from '../lib/catalog';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
test('security audit: explicit table/function permissions, RPC authorization, IDOR and fixed tokens',async()=>{
 const db=await runtimeDatabase();const slug='giai-tich-1-chuong-1-2';const qid='20000000-0000-4000-8000-000000000001';
 const rpc=async(op:string,p:Record<string,unknown>={})=>JSON.parse((await db.query<{d:string}>('select public.quiz_runtime($1,$2) d',[op,JSON.stringify({slug,...p})])).rows[0].d);
 try{
 const token=hash('audit');const meta=await rpc('inspect');await rpc('unlock',{token_hash:token,visitor:hash('owner'),revision:meta.revision});assert.equal((await rpc('session',{token_hash:token,visitor:hash('intruder')})).ok,false);
 await assert.rejects(rpc('unlock',{token_hash:token,visitor:hash('intruder'),revision:meta.revision}),/ACCESS_REQUIRED/);
 const request_id=randomUUID();const {id}=await rpc('start',{token_hash:token,request_id,identity:hash('alice'),participant:{name:'Alice'},revision:meta.revision});
 const other=randomUUID();await db.query("insert into public.quizzes(id,title,slug,status)values($1,'Other','other','published')",[other]);
 await assert.rejects(rpc('get',{slug:'other',token_hash:token,attempt_id:id}),/ACCESS_REQUIRED/);
 for(let i=0;i<10;i++)assert.equal((await rpc('auth_rate',{account:hash('admin-account')})).allowed,true);assert.equal((await rpc('auth_rate',{account:hash('admin-account')})).allowed,false);
 for(let i=0;i<60;i++)assert.equal((await rpc('rate',{visitor:hash('new-cookie'+i)})).allowed,true);assert.equal((await rpc('rate',{visitor:hash('new-cookie61')})).allowed,false);
 for(const role of ['anon','authenticated']){
 await db.exec(`set role ${role};set request.jwt.claim.sub=''`);
 for(const table of ['questions','question_options','short_answer_accepted_answers','attempts','answers','quiz_result_blocks','quiz_result_pages','quiz_access_sessions','quiz_rate_limits','published_quizzes','published_quiz_questions','published_quiz_fields','published_question_options'])await assert.rejects(db.query(`select * from public.${table}`));
 await assert.rejects(db.query('update public.attempts set score=1000,started_at=now(),duration_ms=0 where id=$1',[id]));
 for(const name of ['quiz_runtime','quiz_runtime_v9','quiz_runtime_v8','quiz_runtime_v6'])await assert.rejects(db.query(`select public.${name}($1,$2)`,['inspect',JSON.stringify({slug})]));
 await assert.rejects(db.query('select public.quiz_finalize($1)',[id]));
 await assert.rejects(db.query('select public.admin_result_document($1)',[qid]));
 await assert.rejects(db.query('select public.admin_quiz_document($1)',[qid]));
 await assert.rejects(db.query("select public.admin_results($1,'detail','',1,25,$2)",[qid,id]));
 await assert.rejects(db.query("insert into public.admins(user_id)values($1)",[randomUUID()]));
 await assert.rejects(db.query("create function public.evil()returns int language sql as $$select 1$$"));
 }
 await db.exec('reset role');const admin=randomUUID();await db.exec(`insert into auth.users values('${admin}');insert into public.profiles(id)values('${admin}');insert into public.admins(user_id)values('${admin}');set role authenticated;set request.jwt.claim.sub='${admin}'`);
 await assert.rejects(db.query("select public.admin_results($1,'detail','',1,25,$2)",[other,id]),/NOT_FOUND/);
 await db.exec("reset role;update public.profiles set status='suspended';set role authenticated");assert.equal((await db.query<{ok:boolean}>('select public.is_admin() ok')).rows[0].ok,false);await assert.rejects(db.query('select public.admin_quiz_document($1)',[qid]),/ADMIN_REQUIRED/);
 }finally{await db.close();}
});
test('URL render boundary rejects credentials and browser normalization tricks',()=>{for(const url of ['https://u:p@example.com','https://example.com\\@evil.com','java\nscript:alert(1)','data:text/html,evil'])assert.equal(safeHttpUrl(url),undefined);});
test('decoded image upload rejects forged/truncated files and strips appended script',()=>{
 execFileSync(process.execPath,['--conditions=react-server','--import','tsx','-e',`const assert=require('node:assert/strict');const sharp=require('sharp');const {sanitizeImage}=require('./lib/services/image-upload.ts');(async()=>{await assert.rejects(sanitizeImage(new File([Buffer.from([137,80,78,71,13,10,26,10])],'fake.png',{type:'image/png'})));const png=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();await assert.rejects(sanitizeImage(new File([png],'fake.jpg',{type:'image/jpeg'})));const out=await sanitizeImage(new File([png,Buffer.from('<script>evil()</script>')],'polyglot.png',{type:'image/png'}));assert.equal((await sharp(out).metadata()).format,'webp');assert.ok(!out.toString().includes('<script>'));})().catch(e=>{console.error(e);process.exitCode=1;});`],{stdio:'pipe'});
});
