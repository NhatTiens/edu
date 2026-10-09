import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { cmsPayload, validUrl } from '../lib/cms';
test('CMS validates input and unsafe links',()=>{
 for(const url of ['javascript:alert(1)','//evil.com','/\\evil.com','https://user:pass@example.com']) assert.equal(validUrl(url,true),false);
 const f=new FormData();f.set('title','Course');f.set('sort_order','0');f.set('price','-1');f.set('slug','course');f.set('theme','orange');assert.throws(()=>cmsPayload('courses',f));
 f.set('price','0');assert.equal(cmsPayload('courses',f).status,'draft');
});
test('CMS migration grants admin writes and hides archived/hidden parent records',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;`);
 for(const n of ['0001_initial','0002_security_foundation','0003_production_foundation','0004_homepage_cms','0005_quiz_builder'])await db.exec(readFileSync(new URL(`../supabase/migrations/${n}.sql`,import.meta.url),'utf8').replaceAll('create extension if not exists pgcrypto;',''));
 await db.exec(readFileSync(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
 const admin='00000000-0000-4000-8000-000000000001';await db.exec(`insert into auth.users values('${admin}');insert into public.profiles(id)values('${admin}');insert into public.admins(user_id)values('${admin}');set role authenticated;set request.jwt.claim.sub='${admin}';insert into public.banners(title,status,is_published)values('Draft','draft',false);update public.course_sections set status='archived' where id='10000000-0000-4000-8000-000000000001';`);
 await db.exec('set role anon');assert.equal((await db.query('select * from public.courses')).rows.length,1);assert.equal((await db.query('select * from public.banners')).rows.length,1);await assert.rejects(db.query("insert into public.banners(title)values('Attack')"));
 await db.exec(`reset role;update public.admins set status='suspended';set role authenticated;set request.jwt.claim.sub='${admin}'`);assert.equal((await db.query<{is_admin:boolean}>('select public.is_admin()')).rows[0].is_admin,false);await assert.rejects(db.query("insert into public.banners(title)values('Suspended')"));
 }finally{await db.close();}
});

