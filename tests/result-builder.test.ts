import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { runtimeDatabase } from './helpers/runtime-db';
import { youtubeEmbed,externalUrl,resultDocumentSchema,type ResultDocument } from '../lib/result-blocks';
const id='20000000-0000-4000-8000-000000000001',slug='giai-tich-1-chuong-1-2';
test('YouTube URLs canonicalize to trusted embeds; protocol/host injection is rejected',()=>{
 for(const url of ['https://youtube.com/watch?v=dQw4w9WgXcQ&list=ignored','https://youtu.be/dQw4w9WgXcQ?t=3','http://www.youtube.com/embed/dQw4w9WgXcQ'])assert.equal(youtubeEmbed(url),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 for(const url of ['https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://youtube.com/watch?v=bad','https://youtube.com@evil.com/embed/dQw4w9WgXcQ','https://youtube.com:444/embed/dQw4w9WgXcQ','https://youtube.com/embed/dQw4w9WgXcQ/extra'])assert.equal(youtubeEmbed(url),null);
 for(const url of ['javascript:alert(1)','data:text/html,evil','//example.com','https://user:pass@example.com','https://example.com\\evil'])assert.equal(externalUrl(url),null);
 assert.equal(externalUrl('https://example.com/page'),'https://example.com/page');
});
test('result blocks are gated server-side; edits after submit preserve attempt and keys',async()=>{
 const db=await runtimeDatabase();const rpc=async(op:string,p:Record<string,unknown>={})=>JSON.parse((await db.query<{d:string}>('select public.quiz_runtime($1,$2) as d',[op,JSON.stringify({slug,...p})])).rows[0].d);
 try{
 const admin=randomUUID();await db.exec(`insert into auth.users values('${admin}');insert into public.profiles(id)values('${admin}');insert into public.admins(user_id)values('${admin}');set request.jwt.claim.sub='${admin}';`);
 const meta=await rpc('inspect'),token_hash=createHash('sha256').update('result-session').digest('hex');await rpc('unlock',{revision:meta.revision,token_hash,visitor:'test'});const {id:attempt}=await rpc('start',{revision:meta.revision,token_hash,identity:'b'.repeat(64),request_id:randomUUID(),participant:{name:'Result User'}});await rpc('submit',{token_hash,attempt_id:attempt,answers:{}});
 const before=(await db.query('select to_jsonb(a) as d from public.attempts a where id=$1',[attempt])).rows[0];
 const doc:ResultDocument={quiz_id:id,revision:0,show_percentage:true,show_correct_count:true,show_wrong_count:true,show_duration:true,blocks:[
 {id:randomUUID(),type:'text',title:'Text',content:'<script>not executable</script>',url:'',visibility:'after_submit',scheduled_at:''},
 {id:randomUUID(),type:'youtube',title:'Video',content:'',url:'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',visibility:'after_quiz_closed',scheduled_at:''},
 {id:randomUUID(),type:'button',title:'Future',content:'Open',url:'https://example.com',visibility:'scheduled_at',scheduled_at:'2099-01-01T00:00:00Z'}]};
 assert.equal(resultDocumentSchema.safeParse(doc).success,true);
 const save=async(d:ResultDocument)=>(await db.query<{v:number}>('select public.admin_save_result($1) as v',[JSON.stringify(d)])).rows[0].v;
 await save(doc);await assert.rejects(save(doc),/STALE_VERSION/);
 let result=await rpc('result',{token_hash,attempt_id:attempt});assert.equal(result.blocks.length,1);assert.equal(result.blocks[0].type,'text');assert.equal(result.percentage,0);assert.ok(!result.review);assert.ok(!JSON.stringify(result).includes('Future'));assert.ok(!JSON.stringify(result).includes('dQw4w9WgXcQ'));
 doc.revision=1;doc.blocks[1].url='https://www.youtube-nocookie.com/embed/9bZkp7q19f0';doc.blocks[1].visibility='after_submit';doc.blocks.reverse();doc.show_duration=false;doc.show_correct_count=false;await save(doc);
 result=await rpc('result',{token_hash,attempt_id:attempt});assert.equal(result.blocks[0].type,'youtube');assert.ok(result.blocks[0].url.includes('9bZkp7q19f0'));assert.equal(result.duration_ms,null);assert.equal(result.correct_count,null);
 assert.deepEqual((await db.query('select to_jsonb(a) as d from public.attempts a where id=$1',[attempt])).rows[0],before);assert.equal((await rpc('inspect')).revision,meta.revision);
 doc.revision=2;doc.blocks[1].url='javascript:alert(1)';await assert.rejects(save(doc),/INVALID_YOUTUBE/);assert.equal((await rpc('result',{token_hash,attempt_id:attempt})).blocks.length,2);
 await db.exec(`update public.quiz_result_blocks set scheduled_at=now()-interval '1 minute' where quiz_id='${id}' and visibility='scheduled_at';update public.quizzes set status='closed',show_correct_answers=true where id='${id}'`);
 result=await rpc('result',{token_hash,attempt_id:attempt});assert.equal(result.blocks.length,3);assert.equal(result.review.length,3);assert.equal(result.review[0].answer,null);assert.equal(result.review[0].is_correct,false);assert.equal(result.review[0].points_awarded,0);
 await db.exec(`update public.quizzes set show_correct_answers=false,show_score=false where id='${id}'`);result=await rpc('result',{token_hash,attempt_id:attempt});assert.ok(!result.review);assert.equal(result.score,null);assert.equal(result.percentage,undefined);
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.quiz_result_blocks'));await assert.rejects(db.query('select public.admin_result_document($1)',[id]));
 await db.exec("set role authenticated;set request.jwt.claim.sub=''");await assert.rejects(save(doc),/ADMIN_REQUIRED/);
 }finally{await db.close();}
});
