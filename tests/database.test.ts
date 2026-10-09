import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('migrations enforce RLS, admin membership, constraints and quiz isolation', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
   grant usage on schema public, auth to anon, authenticated;
   grant execute on function auth.uid() to anon, authenticated;`);
  // PGlite already provides gen_random_uuid; production installs pgcrypto on Supabase.
  for (const name of ['0001_initial.sql','0002_security_foundation.sql']) {
   const sql = readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
   await db.exec(sql.replace('create extension if not exists pgcrypto;', ''));
  }
  const admin = '00000000-0000-4000-8000-000000000001';
  const member = '00000000-0000-4000-8000-000000000002';
  await db.exec(`insert into auth.users values ('${admin}'), ('${member}');
   insert into public.admin_users(user_id) values ('${admin}');
   insert into public.courses(title,slug,is_published) values ('Published','public',true),('Draft','draft',false);`);
  await db.exec('set role anon');
  assert.equal((await db.query('select * from public.courses')).rows.length, 1);
  for (const table of ['quizzes','questions','question_options','attempts','answers','quiz_result_blocks','admin_users']) {
   await assert.rejects(db.query(`select * from public.${table}`));
  }
  await assert.rejects(db.query("insert into public.courses(title,slug) values ('Attack','attack')"));
  await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${member}'`);
  assert.equal((await db.query('select * from public.admin_users')).rows.length, 0);
  assert.equal((await db.query('select * from public.questions')).rows.length, 0);
  await assert.rejects(db.query(`insert into public.admin_users(user_id) values ('${member}')`));
  await assert.rejects(db.query("insert into public.courses(title,slug) values ('Attack','attack')"));
  await db.exec(`set request.jwt.claim.sub = '${admin}'`);
  assert.equal((await db.query('select * from public.admin_users')).rows.length, 1);
  assert.equal((await db.query('select * from public.courses')).rows.length, 2);
  await db.query("insert into public.courses(title,slug) values ('Admin course','admin-course')");
  await assert.rejects(db.query("insert into public.courses(title,slug,price) values ('Bad','bad',-1)"));
  await assert.rejects(db.query("insert into public.quizzes(title,slug,duration_minutes) values ('Bad','bad',0)"));
  const a = (await db.query<{id:string}>("insert into public.quizzes(title,slug) values ('A','a') returning id")).rows[0].id;
  const b = (await db.query<{id:string}>("insert into public.quizzes(title,slug) values ('B','b') returning id")).rows[0].id;
  const attempt = (await db.query<{id:string}>(`insert into public.attempts(quiz_id) values ('${a}') returning id`)).rows[0].id;
  const question = (await db.query<{id:string}>(`insert into public.questions(quiz_id,question_type,content) values ('${b}','short_answer','?') returning id`)).rows[0].id;
  await assert.rejects(db.query(`insert into public.answers(quiz_id,attempt_id,question_id) values ('${a}','${attempt}','${question}')`));
 } finally { await db.close(); }
});
