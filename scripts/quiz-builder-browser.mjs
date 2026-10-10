// Browser + real PostgreSQL WASM through a local Supabase HTTP fixture; no production credentials.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { runtimeDatabase } from '../tests/helpers/runtime-db.ts';
import { chromium } from '@playwright/test';
const db=await runtimeDatabase();const id=randomUUID();const now=new Date().toISOString();
await db.exec(`insert into auth.users values('${id}');insert into public.profiles(id) values('${id}');insert into public.admins(user_id) values('${id}');set request.jwt.claim.sub='${id}';`);
const user={id,email:'qa@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:now};
const fixture=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');try{let body='';for await(const chunk of req)body+=chunk;const path=new URL(req.url,'http://127.0.0.1:3330').pathname;
 if(path==='/auth/v1/user')return res.end(JSON.stringify(user));if(path==='/rest/v1/rpc/is_admin')return res.end('true');
 if(path==='/rest/v1/rpc/admin_quiz_document'){const p=JSON.parse(body);const r=await db.query('select public.admin_quiz_document($1) as result',[p.p_id]);return res.end(JSON.stringify(r.rows[0].result));}
 if(path==='/rest/v1/rpc/admin_save_quiz'){const p=JSON.parse(body);const r=await db.query('select public.admin_save_quiz($1,$2,$3) as result',[p.p_document,p.p_password_hash,p.p_remove_password]);return res.end(JSON.stringify(r.rows[0].result));}
 if(path==='/rest/v1/quizzes'){const r=await db.query('select id,title,slug,status,updated_at from public.quizzes');return res.end(JSON.stringify(r.rows));}res.statusCode=404;res.end('{}');
 }catch(e){res.statusCode=400;res.end(JSON.stringify({message:e.message,code:e.code}));}});
await new Promise(r=>fixture.listen(3330,'127.0.0.1',r));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3331'],{env:{...process.env,APP_DATA_MODE:'supabase',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3331',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3330',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-public-key'},stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),20000);server.stdout.on('data',b=>{if(String(b).includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',b=>process.stderr.write(b));});
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{channel:'chromium'})});const context=await browser.newContext();const exp=Math.floor(Date.now()/1000)+3600;const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,exp,role:'authenticated'})).toString('base64url'),'fixture'].join('.');
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user})).toString('base64url'),url:'http://127.0.0.1:3331'}]);
 const page=await context.newPage();await page.goto('http://127.0.0.1:3331/admin/quizzes/new');
 await page.getByLabel('Tên bài kiểm tra',{exact:true}).fill('Browser quiz');await page.getByLabel('Slug',{exact:true}).fill('browser-quiz');await page.getByLabel('Mật khẩu tùy chọn',{exact:true}).fill('not-a-production-password');
 await page.getByRole('button',{name:'Form',exact:true}).click();
 const types=['text','number','email','url','select','radio','checkbox','textarea'];
 for(const [i,type]of types.entries()){
  await page.getByRole('button',{name:'+ Thêm trường',exact:true}).click();await page.getByLabel('Label',{exact:true}).nth(i).fill(type);await page.getByLabel('Key',{exact:true}).nth(i).fill(type);await page.getByLabel('Loại',{exact:true}).nth(i).selectOption(type);
  if(['select','radio','checkbox'].includes(type))await page.getByLabel('Lựa chọn (mỗi dòng một giá trị)',{exact:true}).last().fill('A\nB');
 }
 await page.getByRole('button',{name:'Câu hỏi',exact:true}).click();await page.getByRole('button',{name:'+ Thêm câu hỏi',exact:true}).click();await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Multiple choice?');await page.getByLabel('Lựa chọn 1',{exact:true}).fill('A');await page.getByLabel('Lựa chọn 2',{exact:true}).fill('B');
 await page.getByRole('button',{name:'+ Thêm câu hỏi',exact:true}).click();await page.getByLabel('Loại câu hỏi',{exact:true}).selectOption('true_false');await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('True or false?');await page.getByLabel('Đáp án đúng',{exact:true}).selectOption('false');
 await page.getByRole('button',{name:'+ Thêm câu hỏi',exact:true}).click();await page.getByLabel('Loại câu hỏi',{exact:true}).selectOption('short_answer');await page.getByLabel('Nội dung câu hỏi',{exact:true}).fill('Short answer?');await page.getByLabel('Đáp án chấp nhận (mỗi dòng một đáp án)',{exact:true}).fill(' Hello \nWorld');
 await page.getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('heading',{name:'Xem trước: Short answer?'}).waitFor();
 await page.getByRole('button',{name:'Lưu quiz',exact:true}).click();await page.waitForURL(/\/admin\/quizzes\/[a-f0-9-]{36}$/);const quizId=page.url().split('/').at(-1);
 const read=async()=>JSON.parse((await db.query('select public.admin_quiz_document($1) as d',[quizId])).rows[0].d);const doc=await read();assert.equal(doc.questions.length,3);assert.equal(doc.fields.length,8);assert.equal(doc.questions[1].correct_boolean,false);const secret=(await db.query('select password_hash from public.quizzes where id=$1',[quizId])).rows[0].password_hash;assert.match(secret,/^scrypt\$/);assert.ok(!JSON.stringify(doc).includes(secret));
 await page.goto(`http://127.0.0.1:3331/admin/quizzes/${quizId}/questions`);await page.getByRole('button',{name:/3\. Short answer/}).click();await page.getByRole('button',{name:'Đưa câu hỏi lên',exact:true}).click();await page.getByLabel('Điểm',{exact:true}).fill('2.5');await page.getByRole('button',{name:'Lưu quiz',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu quiz.'}).waitFor();assert.equal((await read()).questions[1].points,2.5);
 await mkdir('artifacts/quiz-builder',{recursive:true});for(const [width,height] of [[375,812],[768,1024],[1440,900]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/quiz-builder/questions-${width}.png`,fullPage:true});}
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Xóa',exact:true}).click();await page.getByRole('button',{name:'Lưu quiz',exact:true}).click();await page.getByText('Đã đồng bộ',{exact:true}).waitFor();assert.equal((await read()).questions.length,2);
 console.log('PASS Quiz Builder browser + PGlite: 8 field types, 3 questions, password hash, save/reload/reorder/points/delete/preview. Supabase live not tested.');
}finally{await browser?.close();server.kill();fixture.close();await db.close();}
