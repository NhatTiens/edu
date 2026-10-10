import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtimeDatabase } from './helpers/runtime-db';
import { defaultPresentation,presentationSchema } from '../lib/site-presentation';
test('dashboard aggregates real rows; settings enforce admin, revision, URL and atomic writes',async()=>{
 const db=await runtimeDatabase();try{
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query('select public.admin_dashboard()'));await assert.rejects(db.query('select public.admin_site_presentation()'));}await db.exec('reset role');
 const id=randomUUID();await db.query('insert into auth.users values($1)',[id]);await db.query('insert into public.profiles(id)values($1)',[id]);await db.query('insert into public.admins(user_id)values($1)',[id]);await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);
 const call=async(sql:string,p:unknown[]=[])=>JSON.parse((await db.query<{d:string}>(sql,p)).rows[0].d);
 const before=await call('select public.admin_site_presentation() d');
 const saved=await call('select public.admin_site_presentation($1,$2) d',[JSON.stringify({...defaultPresentation,name:'Saved school'}),before.revision]);assert.equal(saved.value.name,'Saved school');
 await assert.rejects(call('select public.admin_site_presentation($1,$2) d',[JSON.stringify(defaultPresentation),before.revision]),/STALE_VERSION/);
 for(const value of [{...defaultPresentation,logo:'javascript:alert(1)'},{...defaultPresentation,name:null},{...defaultPresentation,extra:'secret'}])await assert.rejects(call('select public.admin_site_presentation($1,$2) d',[JSON.stringify(value),saved.revision]),/INVALID_/);
 assert.deepEqual(await call('select public.admin_site_presentation() d'),saved);
 const dash=await call('select public.admin_dashboard() d');assert.equal(dash.days.length,7);assert.equal(dash.attempts,0);assert.equal(dash.quizzes,1);assert.ok(dash.courses>0);assert.equal(dash.recent[0].average_score,null);
 await db.exec('reset role');await db.query("insert into public.attempts(quiz_id,status,score,max_score,started_at,submitted_at,duration_ms)values('20000000-0000-4000-8000-000000000001','submitted',2,3,now()-interval '1 minute',now(),60000)");await db.exec('set role authenticated');const actual=await call('select public.admin_dashboard() d');assert.equal(actual.attempts,1);assert.equal(actual.today,1);assert.equal(actual.recent[0].average_score,2);
 await db.exec('set role anon');const publicSettings=await db.query<{value:{name:string}}>("select value from public.site_settings where key='site.presentation'");assert.equal(publicSettings.rows[0].value.name,'Saved school');
 for(const url of ['javascript:alert(1)','https://u:p@example.com','https://example.com\\@evil.com'])assert.equal(presentationSchema.safeParse({...defaultPresentation,logo:url}).success,false);
 }finally{await db.close();}
});
