// Test-only Supabase-shaped adapter: real migrations/RLS/RPC in PostgreSQL WASM.
// Auth and Storage are local deterministic emulators, never production credentials.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { runtimeDatabase } from '../../tests/helpers/runtime-db.ts';
export async function finalFixture(port=3360){
 const db=await runtimeDatabase(),admin=randomUUID(),tokens=new Set(),uploads=new Map();
 await db.query('insert into auth.users values($1)',[admin]);await db.query('insert into public.profiles(id)values($1)',[admin]);await db.query('insert into public.admins(user_id)values($1)',[admin]);
 const user={id:admin,email:'qa@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
 const state={failTable:'',delayTable:'',failRpc:'',delayRpc:'',delayLogin:false};
 const schema={};for(const table of ['banners','courses','course_sections','quizzes','site_settings'])schema[table]=new Set((await db.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2',['public',table])).rows.map(r=>r.column_name));
 const rpcs={
 is_admin:['select public.is_admin() d',()=>[]],
 admin_dashboard:['select public.admin_dashboard() d',()=>[]],
 admin_site_presentation:['select public.admin_site_presentation($1,$2) d',p=>[p.p_value??null,p.p_revision??null]],
 admin_quiz_document:['select public.admin_quiz_document($1) d',p=>[p.p_id]],
 admin_save_quiz:['select public.admin_save_quiz($1,$2,$3) d',p=>[p.p_document,p.p_password_hash??null,p.p_remove_password??false]],
 admin_result_document:['select public.admin_result_document($1) d',p=>[p.p_id]],
 admin_save_result:['select public.admin_save_result($1) d',p=>[p.p_document]],
 admin_results:['select public.admin_results($1,$2,$3,$4,$5,$6) d',p=>[p.p_quiz,p.p_op,p.p_search??'',p.p_page??1,p.p_size??25,p.p_attempt??null]],
 admin_leaderboard_settings:['select public.admin_leaderboard_settings($1,$2,$3,$4) d',p=>[p.p_quiz,p.p_revision,p.p_enabled,p.p_keys]],
 quiz_runtime:['select public.quiz_runtime($1,$2) d',p=>[p.p_op,p.p_payload]]};
 const server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,`http://127.0.0.1:${port}`),path=u.pathname,token=req.headers.authorization?.replace('Bearer ','');
  const isAdmin=tokens.has(token),isService=token==='final-qa-service';
  const chunks=[];for await(const c of req)chunks.push(c);const bytes=Buffer.concat(chunks);res.setHeader('Content-Type','application/json');
  const payload=()=>bytes.length?JSON.parse(bytes.toString()):{};
  if(path==='/auth/v1/token'){
   if(state.delayLogin)await new Promise(r=>setTimeout(r,500));
   const p=payload();if(p.email!==user.email||p.password!=='qa-admin-password'){res.statusCode=400;return res.end(JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials'}));}
   const exp=Math.floor(Date.now()/1000)+3600;const access_token=[Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url'),Buffer.from(JSON.stringify({sub:admin,exp,role:'authenticated',nonce:randomUUID()})).toString('base64url'),'fixture'].join('.');tokens.add(access_token);return res.end(JSON.stringify({access_token,refresh_token:randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user}));
  }
  if(path==='/auth/v1/user'){if(!isAdmin){res.statusCode=401;return res.end(JSON.stringify({message:'Unauthorized'}));}return res.end(JSON.stringify(user));}
  if(path==='/auth/v1/logout'){tokens.delete(token);res.statusCode=204;return res.end();}
  if(path.startsWith('/storage/v1/object/public/')){const key=path.slice('/storage/v1/object/public/'.length),stored=uploads.get(key);if(!stored){res.statusCode=404;return res.end('{}');}res.setHeader('Content-Type','image/webp');return res.end(stored);}
  if(path.startsWith('/storage/v1/object/')){
   if(!isAdmin){res.statusCode=403;return res.end('{}');}const key=path.slice('/storage/v1/object/'.length);
   if(req.method==='POST'){uploads.set(key,bytes);return res.end(JSON.stringify({Key:key}));}
   if(req.method==='DELETE'){for(const name of payload().prefixes??[])uploads.delete(key+'/'+name);return res.end('[]');}
  }
  const fn=path.split('/').at(-1);
  if(path.startsWith('/rest/v1/rpc/')&&rpcs[fn]){
   if(state.failRpc===fn){res.statusCode=503;return res.end(JSON.stringify({message:'fixture unavailable'}));}
   if(state.delayRpc===fn)await new Promise(r=>setTimeout(r,600));
   const [sql,args]=rpcs[fn];const r=await db.transaction(async tx=>{await tx.exec(`set local role ${isService?'service_role':isAdmin?'authenticated':'anon'}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[isAdmin?admin:'']);return tx.query(sql,args(payload()));});return res.end(JSON.stringify(r.rows[0].d));
  }
  if(path.startsWith('/rest/v1/')&&schema[fn]){
   if(state.failTable===fn){res.statusCode=503;return res.end(JSON.stringify({message:'fixture unavailable'}));}
   if(state.delayTable===fn)await new Promise(r=>setTimeout(r,600));
   const cols=schema[fn],ident=k=>{if(!cols.has(k))throw Error('Unknown column');return '"'+k+'"';},params=[],where=[];
   for(const [k,v]of u.searchParams)if(v.startsWith('eq.')){params.push(v.slice(3));where.push(`${ident(k)}=$${params.length}`);}
   const filter=where.length?' where '+where.join(' and '):'';
   let sql=`select * from public.${fn}${filter}`;
   if(req.method==='POST'){const p=payload(),keys=Object.keys(p);params.length=0;for(const k of keys)params.push(p[k]);sql=`insert into public.${fn}(${keys.map(ident)}) values(${keys.map((_,i)=>'$'+(i+1))}) returning *`;}
   else if(req.method==='PATCH'){const p=payload();const sets=Object.entries(p).map(([k,v])=>{params.push(v);return `${ident(k)}=$${params.length}`;});sql=`update public.${fn} set ${sets.join(',')}${filter} returning *`;}
   else if(u.searchParams.has('order')){const order=u.searchParams.get('order').split(',').map(part=>{const [col,dir]=part.split('.');return ident(col)+(dir==='desc'?' desc':' asc');});sql+=' order by '+order.join(',');}
   const r=await db.transaction(async tx=>{await tx.exec(`set local role ${isAdmin?'authenticated':'anon'}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[isAdmin?admin:'']);return tx.query(sql,params);});
   return res.end(JSON.stringify(req.headers.accept?.includes('object+json')?(r.rows[0]??null):r.rows));
  }
  res.statusCode=404;res.end('{}');
 }catch(e){res.statusCode=400;res.end(JSON.stringify({message:e.message,code:e.code}));}});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 return {db,state,uploads,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();}};
}
