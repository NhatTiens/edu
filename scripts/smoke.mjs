import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3312';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3312'],{env:{...process.env,APP_DATA_MODE:'supabase',NEXT_PUBLIC_SITE_URL:base,NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_ANON_KEY:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',QUIZ_SESSION_SECRET:''},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),15000);server.stdout.on('data',b=>{if(String(b).includes('Ready')){clearTimeout(timer);resolve();}});server.once('error',reject);});
 const admin=await fetch(base+'/admin',{redirect:'manual'});assert.equal(admin.status,307);assert.equal(new URL(admin.headers.get('location'),base).pathname,'/admin/login');
 const response=await fetch(base+'/api/quiz/example/unlock',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({password:''})});assert.equal(response.status,503);assert.equal((await response.json()).error,'UNAVAILABLE');
 for(const page of ['/q/example','/q/example/result/00000000-0000-4000-8000-000000000001']){const html=await(await fetch(base+page)).text();assert.ok(!html.includes('Hoàn thành bài kiểm tra!'));assert.ok(!html.includes('Dữ liệu mẫu'));}
 console.log('PASS unconfigured runtime fails closed; admin redirects; no mock quiz result.');
}finally{server.kill();}
