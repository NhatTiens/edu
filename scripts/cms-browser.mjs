import sharp from 'sharp';
// Local HTTP fixture exercises application rendering/actions, not Supabase integration.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const id='10000000-0000-4000-8000-000000000001';const now=new Date().toISOString();
const base={id,title:'Giải tích 1',description:'Nền tảng toán học và bài tập thực hành.',sort_order:0,status:'published',is_published:true,created_at:now,updated_at:now};
const data={course_sections:[{...base,title:'Khóa học nổi bật'}],courses:[{...base,slug:'giai-tich-1',section_id:id,price:99000,old_price:199000,badge:'Ôn thi',theme:'orange',category:'Giải tích',teacher_name:'A. Vương',teacher_link:'https://example.com/teacher',course_link:'https://example.com/course',thumbnail_url:null}],banners:[{...base,title:'Nắm vững kiến thức',button_text:'Khám phá khóa học',target_url:'/search',open_new_tab:false,image_url:null}]};
const user={id,email:'test@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:now};
const fixture=createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:3320');let body='';for await(const c of req)body+=c;res.setHeader('Content-Type','application/json');if(u.pathname.startsWith('/storage/v1/object/'))return res.end(JSON.stringify({Key:u.pathname.slice(19)}));if(u.pathname==='/auth/v1/user')return res.end(JSON.stringify(user));if(u.pathname==='/rest/v1/rpc/is_admin')return res.end('true');const table=u.pathname.split('/').at(-1);if(!data[table]){res.statusCode=404;return res.end('{}');}let rows=data[table];for(const [k,v]of u.searchParams){if(v.startsWith('eq.'))rows=rows.filter(r=>String(r[k])===v.slice(3));}if(req.method==='PATCH'){const updates=JSON.parse(body);for(const r of rows)Object.assign(r,updates,{updated_at:new Date().toISOString()});}if(req.method==='POST'){const record={...JSON.parse(body),id:crypto.randomUUID(),created_at:now,updated_at:new Date().toISOString()};data[table].push(record);rows=[record];}res.end(JSON.stringify(req.headers.accept?.includes('object+json')?(rows[0]??null):rows));});
await new Promise(r=>fixture.listen(3320,'127.0.0.1',r));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3321'],{env:{...process.env,APP_DATA_MODE:'supabase',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3320',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-public-key',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-public-key'},stdio:['ignore','pipe','pipe']});
let browser;
try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Startup timeout')),20000);server.stdout.on('data',b=>{if(String(b).includes('Ready')){clearTimeout(timer);resolve();}});server.stderr.on('data',b=>process.stderr.write(b));});
 browser=await chromium.launch({headless:true,channel:'chromium'});const context=await browser.newContext();
 const exp=Math.floor(Date.now()/1000)+3600;const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,exp,role:'authenticated'})).toString('base64url'),'test-signature'].join('.');
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify({access_token:jwt,refresh_token:'test-refresh-token',expires_at:exp,expires_in:3600,token_type:'bearer',user})).toString('base64url'),url:'http://127.0.0.1:3321'}]);
 const page=await context.newPage();await mkdir('artifacts/cms-qa',{recursive:true});
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:950});for(const [route,label]of [['/','home'],['/admin/courses','courses'],['/admin/courses/new','course-form'],['/admin/banners/new','banner-form'],['/admin/course-sections/new','section-form']]){await page.goto('http://127.0.0.1:3321'+route);await page.waitForLoadState('networkidle');assert.ok(!page.url().includes('/login'),'Admin session fixture failed');const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)console.log(await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right])));assert.equal(overflow,false,`${label} overflow ${width}`);await page.screenshot({path:`artifacts/cms-qa/${label}-${width}.png`,fullPage:true});}}
 await page.goto('http://127.0.0.1:3321/admin/courses/new');await page.getByLabel('Tiêu đề',{exact:true}).fill('Course QA');await page.getByLabel('Slug',{exact:true}).fill('qa-course');await page.getByRole('button',{name:'Lưu thay đổi'}).click();await page.getByRole('status').filter({hasText:'Đã lưu thay đổi'}).waitFor();assert.ok(data.courses.some(c=>c.slug==='qa-course'));
 for (const [route,table] of [['banners','banners'],['course-sections','course_sections']]) {
  await page.goto(`http://127.0.0.1:3321/admin/${route}/new`);
  await page.getByLabel('Tiêu đề',{exact:true}).fill(`QA ${table}`);
  await page.getByRole('button',{name:'Lưu thay đổi'}).click();
  await page.getByRole('status').filter({hasText:'Đã lưu thay đổi'}).waitFor();
  assert.ok(data[table].some(r=>r.title===`QA ${table}`));
 }
 const created=data.courses.find(c=>c.slug==='qa-course');
 await page.goto(`http://127.0.0.1:3321/admin/courses/${created.id}`);
 await page.getByLabel('Tiêu đề',{exact:true}).fill('Course edited');
 await page.getByLabel('Thứ tự (số nhỏ xuất hiện trước)',{exact:true}).fill('9');
 await page.getByRole('button',{name:'Lưu thay đổi'}).click();
 await page.getByRole('status').filter({hasText:'Đã lưu thay đổi'}).waitFor();
 assert.equal(created.sort_order,9);assert.equal(created.title,'Course edited');
 await page.goto('http://127.0.0.1:3321/admin/courses');
 const row=page.getByRole('row').filter({hasText:'Course edited'});
 await row.getByRole('button',{name:'Hiện',exact:true}).click();
 await row.getByRole('button',{name:'Ẩn',exact:true}).waitFor();assert.equal(created.is_published,true);
 await row.getByRole('button',{name:'Ẩn',exact:true}).click();
 await row.getByRole('button',{name:'Hiện',exact:true}).waitFor();assert.equal(created.is_published,false);
 page.once('dialog',dialog=>dialog.accept());await row.getByRole('button',{name:'Lưu trữ',exact:true}).click();
 await row.locator('span.status').filter({hasText:'Lưu trữ'}).waitFor();assert.equal(created.status,'archived');
 await row.getByRole('button',{name:'Hiện',exact:true}).click();await row.getByRole('button',{name:'Ẩn',exact:true}).waitFor();
 assert.equal(created.status,'published');
 await page.goto(`http://127.0.0.1:3321/admin/courses/${created.id}`);
 await page.locator('input[type=file]').setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
 await page.getByRole('button',{name:'Lưu thay đổi'}).click();
 await page.getByRole('alert').filter({hasText:'Ảnh không hợp lệ, quá lớn hoặc không khớp MIME type.'}).waitFor();
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 await page.locator('input[type=file]').setInputFiles({name:'preview.png',mimeType:'image/png',buffer:png});
 await page.getByAltText('Xem trước ảnh').waitFor();
 await page.getByRole('button',{name:'Lưu thay đổi'}).click();
 await page.getByRole('status').filter({hasText:'Đã lưu thay đổi'}).waitFor();
 assert.ok(created.thumbnail_url.includes('/storage/v1/object/public/course-thumbnails/'));
 await page.goto('http://127.0.0.1:3321/search?q=khongco');await page.getByText('Không có khóa học phù hợp. Thử từ khóa khác.').waitFor();
 console.log('PASS local HTTP fixture: CMS create/edit/hide/publish/archive/restore; search empty; no overflow across 15 route/viewport combinations. Not live Supabase integration.');
}finally{await browser?.close();server.kill();fixture.close();}





