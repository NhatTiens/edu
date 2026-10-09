import { isBuilderAnswerCorrect } from '../lib/scoring';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { builderSchema,newQuiz,normalizeShortAnswer,publicQuestion,validateParticipant,fieldTypes,type QuizBuilderData,type BuilderField } from '../lib/quiz-builder';
function fixture():QuizBuilderData{
 const option=randomUUID();return {...newQuiz(),title:'Quiz test',slug:'quiz-test',status:'published',questions:[
 {id:randomUUID(),type:'multiple_choice',content:'One?',points:1,sort_order:0,options:[{id:option,content:'A'},{id:randomUUID(),content:'B'}],correct_option_id:option,correct_boolean:true,accepted_answers:[],case_insensitive:true},
 {id:randomUUID(),type:'true_false',content:'Boolean?',points:2,sort_order:1,options:[],correct_option_id:'',correct_boolean:false,accepted_answers:[],case_insensitive:true},
 {id:randomUUID(),type:'short_answer',content:'Value?',points:0.5,sort_order:2,options:[],correct_option_id:'',correct_boolean:true,accepted_answers:[' Hello ','4'],case_insensitive:true}],fields:fieldTypes.map((type,i)=>({id:randomUUID(),label:type,key:type,type,placeholder:'',required:true,options:['select','radio','checkbox'].includes(type)?['A','B']:[],sort_order:i,is_identifier:type==='email',show_on_leaderboard:type==='text'}))};
}
function document(q:QuizBuilderData){const {password,has_password,remove_password,...d}=q;void password;void has_password;void remove_password;return JSON.stringify(d);}
test('builder validates all field types, answers, duplicate keys and schedule',()=>{
 const q=fixture();assert.equal(builderSchema.safeParse(q).success,true);assert.equal(isBuilderAnswerCorrect(q.questions[2],'  HELLO  '),true);q.questions[2].case_insensitive=false;assert.equal(isBuilderAnswerCorrect(q.questions[2],'HELLO'),false);assert.equal(isBuilderAnswerCorrect(q.questions[2],' Hello '),true);assert.equal(isBuilderAnswerCorrect(q.questions[1],false),true);
 q.fields[1].key=q.fields[0].key;assert.equal(builderSchema.safeParse(q).success,false);q.fields[1].key='number';
 q.questions[0].correct_option_id='unknown';assert.equal(builderSchema.safeParse(q).success,false);
 assert.equal(normalizeShortAnswer('  École  '),'école');assert.notEqual(normalizeShortAnswer('A',false),normalizeShortAnswer('a',false));
 const safe=JSON.stringify(q.questions.map(publicQuestion));for(const key of ['correct_option_id','accepted_answers','case_insensitive','correct_boolean'])assert.ok(!safe.includes(key));
});
test('participant validation enforces types, options and required fields',()=>{
 const fields=fixture().fields;assert.deepEqual(validateParticipant(fields,{text:'Name',number:'2.5',email:'a@example.com',url:'https://example.com',select:'A',radio:'B',checkbox:['A'],textarea:'notes'}),{});
 const errors=validateParticipant(fields,{number:'NaN',email:'bad',url:'javascript:alert(1)',select:'unknown',radio:'C',checkbox:['X']});assert.equal(Object.keys(errors).length,8);
 const identifier:BuilderField={...fields[0],type:'checkbox',is_identifier:true};assert.equal(builderSchema.safeParse({...fixture(),fields:[identifier]}).success,false);
});
test('password hashing uses unique salt and verifies only correct password',()=>{
 execFileSync(process.execPath,['--conditions=react-server','--import','tsx','-e',`const assert=require('node:assert/strict');const {hashQuizPassword,verifyQuizPassword}=require('./lib/auth/quiz-password.ts');(async()=>{const a=await hashQuizPassword('password-test');const b=await hashQuizPassword('password-test');assert.notEqual(a,b);assert.ok(!a.includes('password-test'));assert.equal(await verifyQuizPassword('password-test',a),true);assert.equal(await verifyQuizPassword('wrong',a),false);})().catch(e=>{console.error(e);process.exitCode=1});`],{stdio:'pipe'});
});
test('atomic quiz builder lifecycle, rollback, admin-only access and safe public DTOs',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;`);
 for(const n of ['0001_initial','0002_security_foundation','0003_production_foundation','0004_homepage_cms','0005_quiz_builder'])await db.exec(readFileSync(new URL(`../supabase/migrations/${n}.sql`,import.meta.url),'utf8').replaceAll('create extension if not exists pgcrypto;',''));
 const admin=randomUUID();await db.exec(`insert into auth.users values('${admin}');insert into public.profiles(id)values('${admin}');insert into public.admins(user_id)values('${admin}');set role authenticated;set request.jwt.claim.sub='${admin}'`);
 await db.exec('reset role');
 await db.exec(readFileSync(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');
 const seed=JSON.parse((await db.query<{d:string}>("select public.admin_quiz_document('20000000-0000-4000-8000-000000000001') as d")).rows[0].d);
 assert.equal(builderSchema.parse(seed).questions.length,3);assert.equal(seed.fields.length,8);
 const q=fixture();const hash=`scrypt$${'a'.repeat(32)}$${'b'.repeat(128)}`;
 const save=async(doc:QuizBuilderData,h:string|null=null,remove=false)=>(await db.query<{id:string}>('select public.admin_save_quiz($1,$2,$3) as id',[document(doc),h,remove])).rows[0].id;
 const id=await save(q,hash);
 const load=async()=>builderSchema.parse(JSON.parse((await db.query<{doc:string}>('select public.admin_quiz_document($1) as doc',[id])).rows[0].doc));
 let loaded=await load();assert.equal(loaded.questions.length,3);assert.equal(loaded.fields.length,8);assert.equal(loaded.has_password,true);assert.equal(loaded.password,'');assert.equal(loaded.questions[1].correct_boolean,false);
 assert.ok(!JSON.stringify(loaded).includes(hash));
 const stale={...loaded};loaded.title='Updated';loaded.questions.reverse();loaded.fields.reverse();await save(loaded);await assert.rejects(save(stale),/STALE_VERSION/);
 loaded=await load();const bad=structuredClone(loaded);bad.title='Should rollback';bad.questions.find(q=>q.type==='multiple_choice')!.correct_option_id=randomUUID();await assert.rejects(save(bad),/ONE_CORRECT_OPTION_REQUIRED/);assert.equal((await load()).title,'Updated');
 loaded=await load();loaded.questions=loaded.questions.filter(q=>q.type!=='true_false');await save(loaded,null,true);loaded=await load();assert.equal(loaded.questions.length,2);assert.equal(loaded.has_password,false);
 await db.exec('set role anon');await assert.rejects(db.query('select public.admin_quiz_document($1)',[id]));await assert.rejects(save(q));
 for(const table of ['questions','question_options','short_answer_accepted_answers','attempts','answers'])await assert.rejects(db.query(`select * from public.${table}`));
 const publicRows=await db.query('select * from public.published_quiz_questions where quiz_id=$1',[id]);assert.equal(publicRows.rows.length,2);assert.ok(!JSON.stringify(publicRows.rows).includes('accepted_answers'));await assert.rejects(db.query('select is_correct from public.published_question_options'));
 await db.exec(`set role authenticated;set request.jwt.claim.sub=''`);await assert.rejects(save(q),/ADMIN_REQUIRED/);
 await db.exec(`reset role;insert into public.attempts(quiz_id)values('${id}');set role authenticated;set request.jwt.claim.sub='${admin}'`);await assert.rejects(save({...loaded,title:'Changed after attempt'}),/QUIZ_HAS_ATTEMPTS/);loaded.status='closed';await save(loaded);assert.equal((await load()).status,'closed');
 }finally{await db.close();}
});


