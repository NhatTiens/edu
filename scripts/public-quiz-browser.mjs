// Full production UI + real PostgreSQL WASM, via an HTTP Supabase service fixture.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes,scryptSync } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { runtimeDatabase } from '../tests/helpers/runtime-db.ts';
const db=await runtimeDatabase();const slug='giai-tich-1-chuong-1-2';const quiz='20000000-0000-4000-8000-000000000001';const base='http://127.0.0.1:3341';const secretAnswer='runtime-private-answer-'+randomBytes(8).toString('hex');
await db.query('insert into public.short_answer_accepted_answers(question_id,answer,answer_normalized) values($1,$2,$2)',['20000000-0000-4000-8000-000000000203',secretAnswer]);
const fixture=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.headers.authorization!=='Bearer local-test-service'){res.statusCode=401;return res.end('{}');}try{let body='';for await(const chunk of req)body+=chunk;if(new URL(req.url,'http://127.0.0.1:3340').pathname!=='/rest/v1/rpc/quiz_runtime'){res.statusCode=404;return res.end('{}');}const p=JSON.parse(body);const result=await db.transaction(async tx=>{await tx.exec('set local role service_role');return tx.query('select public.quiz_runtime($1,$2) as value',[p.p_op,p.p_payload]);});res.end(JSON.stringify(result.rows[0].value));}catch(e){res.statusCode=400;res.end(JSON.stringify({message:e.message,code:e.code}));}});
await new Promise(resolve=>fixture.listen(3340,'127.0.0.1',resolve));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3341'],{env:{...process.env,APP_DATA_MODE:'supabase',NEXT_PUBLIC_SITE_URL:base,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3340',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-public-key',SUPABASE_SERVICE_ROLE_KEY:'local-test-service',QUIZ_SESSION_SECRET:'local-test-secret-not-for-production-123456'},stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),20000);server.stdout.on('data',b=>{if(String(b).includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',b=>process.stderr.write(b));});
 console.log('QA server ready');
 browser=await chromium.launch({headless:true,channel:'chromium'});const context=await browser.newContext();const fixedCookie='quiz_access_'+(await import('node:crypto')).createHash('sha256').update(slug).digest('hex').slice(0,20);await context.addCookies([{name:fixedCookie,value:'f'.repeat(64),url:base}]);const page=await context.newPage();page.on('dialog',d=>d.accept());const captured=[];const captures=[];
 page.on('requestfinished',req=>{if(req.url().startsWith(base))captures.push(req.response().then(r=>r.text()).then(body=>captured.push(body)).catch(()=>{}));});
 console.log('QA browser ready');
 await page.goto(base+'/q/not-found');await page.getByRole('heading',{name:'Không tìm thấy bài kiểm tra hoặc bài làm'}).waitFor();
 for(const [sql,text]of [["status='draft'",'Bài kiểm tra chưa được xuất bản.'],["status='published',open_at=now()+interval '1 hour'",'Bài kiểm tra chưa đến giờ mở.'],["status='closed',open_at=null",'Bài kiểm tra đã đóng.']]){await db.exec(`update public.quizzes set ${sql} where id='${quiz}'`);await page.goto(`${base}/q/${slug}`);await page.getByText(text,{exact:true}).waitFor();}
 await db.exec(`update public.quizzes set status='published' where id='${quiz}'`);
 await page.goto(`${base}/q/${slug}`);await page.getByLabel('Họ và tên *',{exact:true}).fill('  Alice  ');await page.getByRole('button',{name:'Bắt đầu làm bài'}).click();await page.waitForURL(/\/attempt\//);const id=page.url().split('/').at(-1);
 console.log('QA attempt started');
 const cookies=await context.cookies();assert.notEqual(cookies.find(c=>c.name===fixedCookie)?.value,'f'.repeat(64));assert.ok(cookies.find(c=>c.name.startsWith('quiz_access_'))?.httpOnly);assert.ok(!await page.evaluate(()=>document.cookie.includes('quiz_access_')));
 const request=async(op,body)=>context.request.post(`${base}/api/quiz/${slug}/${op}`,{headers:{Origin:base},data:body});
 const before=await (await context.request.get(`${base}/api/quiz/${slug}/get?attemptId=${id}`)).json();assert.equal(before.questions.length,3);
 const rejected=await request('submit',{attemptId:id,answers:{},score:999,duration_ms:0});assert.equal(rejected.status(),400);
 const csrf=await context.request.post(`${base}/api/quiz/${slug}/submit`,{data:{attemptId:id,answers:{}}});assert.equal(csrf.status(),403);
 await page.getByLabel('Đúng với mọi x ∈ R',{exact:true}).check();await page.getByText('Đã lưu đáp án.',{exact:true}).waitFor();
 console.log('QA first answer saved');
 await page.reload();await page.getByLabel('Đúng với mọi x ∈ R',{exact:true}).waitFor();assert.equal(await page.getByLabel('Đúng với mọi x ∈ R',{exact:true}).isChecked(),true);
 const after=await (await context.request.get(`${base}/api/quiz/${slug}/get?attemptId=${id}`)).json();assert.equal(after.started_at,before.started_at);assert.equal(after.expires_at,before.expires_at);
 await page.getByRole('button',{name:'Câu tiếp',exact:true}).click();await page.getByLabel('Đúng',{exact:true}).check();await page.getByRole('button',{name:'Câu tiếp',exact:true}).click();await page.getByLabel('Câu trả lời',{exact:true}).fill(' 4.0 ');
 await page.getByText('Đã lưu đáp án.',{exact:true}).waitFor();
 captured.push(await page.content());captured.push(JSON.stringify(before),JSON.stringify(after));
 const rsc=await context.request.get(`${base}/q/${slug}/attempt/${id}`,{headers:{RSC:'1'}});assert.equal(rsc.status(),200);captured.push(await rsc.text());
 for(const file of await readdir('.next/static',{recursive:true})){if(file.endsWith('.js'))captured.push(await readFile('.next/static/'+file,'utf8'));}
 // Completed browser response captures supplement the explicitly awaited HTML/RSC/API/bundle checks.
 await Promise.race([Promise.all(captures),new Promise(resolve=>setTimeout(resolve,1000))]);
 const state=await page.evaluate(()=>{const seen=new WeakSet();const found=[];const forbidden=['correct_option_id','correct_boolean','accepted_answers','password_hash','participant_data','question_snapshot'];function visit(v,depth){if(depth>10||!v||typeof v!=='object'||seen.has(v))return;seen.add(v);for(const k of Object.keys(v)){if(forbidden.includes(k))found.push(k);if(!['return','_owner','stateNode','alternate'].includes(k))visit(v[k],depth+1);}}for(const el of document.querySelectorAll('*'))for(const key of Object.keys(el))if(key.startsWith('__reactProps')||key.startsWith('__reactFiber'))visit(el[key],0);return found;});assert.deepEqual(state,[]);for(const body of captured){assert.ok(!body.includes(secretAnswer));assert.ok(!body.includes('local-test-service'));assert.ok(!body.includes('local-test-secret-not-for-production'));}
 for(const key of ['correct_option_id','correct_boolean','accepted_answers','password_hash','participant_data'])assert.ok(!JSON.stringify(after).includes(key));
 await mkdir('artifacts/public-quiz',{recursive:true});await page.setViewportSize({width:375,height:950});await page.screenshot({path:'artifacts/public-quiz/attempt-375.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Nộp bài',exact:true}).click();await page.waitForURL(/\/result\//);await page.getByText('3 / 3',{exact:true}).waitFor();await page.getByRole('link',{name:'Bảng xếp hạng'}).click();await page.getByRole('cell',{name:'Họ và tên: Alice',exact:true}).waitFor();
 const stored=(await db.query('select * from public.attempts where id=$1',[id])).rows[0];assert.equal(Number(stored.score),3);assert.equal(stored.correct_count,3);assert.ok(Math.abs(Number(stored.duration_ms)-(new Date(stored.submitted_at).getTime()-new Date(stored.started_at).getTime()))<=1);
 const duplicates=await Promise.all([request('submit',{attemptId:id,answers:{}}),request('submit',{attemptId:id,answers:{}})]);for(const res of duplicates)assert.equal(res.status(),200);assert.equal((await db.query('select * from public.answers where attempt_id=$1',[id])).rows.length,3);
 const again=await request('start',{requestId:crypto.randomUUID(),participant:{name:'ALICE'}});assert.equal((await again.json()).error,'ATTEMPT_LIMIT');
 const stranger=await browser.newContext();const adminAttack=await stranger.request.get(base+'/admin/quizzes/'+quiz+'/participants/export',{maxRedirects:0});assert.ok([307,401].includes(adminAttack.status()));assert.equal((await stranger.request.get(`${base}/api/quiz/${slug}/get?attemptId=${id}`)).status(),401);
 // Password protected flow, including correct/incorrect password and unlock rate limit.
 const salt=randomBytes(16).toString('hex');const password='local-password-test';const passwordHash=`scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;await db.query('update public.quizzes set password_hash=$1 where id=$2',[passwordHash,quiz]);
 const protectedPage=await stranger.newPage();await protectedPage.goto(`${base}/q/${slug}`);await protectedPage.getByLabel('Mật khẩu bài kiểm tra',{exact:true}).fill('wrong');await protectedPage.getByRole('button',{name:'Mở khóa'}).click();await protectedPage.getByRole('alert').filter({hasText:'Mật khẩu chưa đúng.'}).waitFor();assert.ok(!protectedPage.url().includes('wrong'));
 await protectedPage.getByLabel('Mật khẩu bài kiểm tra',{exact:true}).fill(password);await protectedPage.getByRole('button',{name:'Mở khóa'}).click();await protectedPage.getByLabel('Họ và tên *',{exact:true}).waitFor();assert.ok(!protectedPage.url().includes(password));assert.ok(!(await protectedPage.content()).includes(passwordHash));
 await protectedPage.getByLabel('Họ và tên *',{exact:true}).fill('Bob');await protectedPage.getByRole('button',{name:'Bắt đầu làm bài'}).click();await protectedPage.waitForURL(/\/attempt\//);const bobId=protectedPage.url().split('/').at(-1);
 await db.query("update public.attempts set started_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' where id=$1",[bobId]);
 const late=await stranger.request.post(`${base}/api/quiz/${slug}/submit`,{headers:{Origin:base},data:{attemptId:bobId,answers:{'20000000-0000-4000-8000-000000000203':'4'}}});assert.equal(late.status(),200);assert.equal(Number((await db.query('select score from public.attempts where id=$1',[bobId])).rows[0].score),0);
 const limited=await browser.newContext();for(let i=0;i<8;i++){const r=await limited.request.post(`${base}/api/quiz/${slug}/unlock`,{headers:{Origin:base},data:{password:'wrong'}});assert.equal(r.status(),401);}const limit=await limited.request.post(`${base}/api/quiz/${slug}/unlock`,{headers:{Origin:base},data:{password:'wrong'}});assert.equal(limit.status(),429);
 console.log('PASS public quiz seed E2E: availability, no/password unlock, HttpOnly ownership, form/start/resume/submit/result/leaderboard, server grading, rate limit, attempt limit, CSRF, late/duplicate submit, response leakage checks. Local PostgreSQL WASM; Supabase cloud not tested.');
}catch(e){console.error('QA failure',e);throw e;}finally{console.log('QA cleanup');await browser?.close();server.kill();fixture.close();await db.close();}


