import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
export async function runtimeDatabase(consolidated = false) {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;`,
  );
  if (consolidated)
    await db.exec(
      readFileSync(
        new URL("../../supabase/schema.sql", import.meta.url),
        "utf8",
      ).replaceAll("create extension if not exists pgcrypto;", ""),
    );
  else
    for (const name of [
      "0001_initial",
      "0002_security_foundation",
      "0003_production_foundation",
      "0004_homepage_cms",
      "0005_quiz_builder",
      "0006_public_quiz_runtime",
      "0007_result_builder",
      "0008_result_builder_validation",
      "0009_results_data",
      "0010_security_audit",
      "0011_security_followup",
      "0012_final_qa",
    ])
      await db.exec(
        readFileSync(
          new URL(`../../supabase/migrations/${name}.sql`, import.meta.url),
          "utf8",
        ).replaceAll("create extension if not exists pgcrypto;", ""),
      );
  await db.exec(
    readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8"),
  );
  return db;
}
