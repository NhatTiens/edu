-- Production foundation for databases that already applied 0001 and 0002.
-- Review legacy rows before applying. The migration intentionally fails on invalid data.
begin;

create extension if not exists pgcrypto;

-- Auth identity and administration are separate from user supplied metadata.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id)
select user_id from public.admin_users
on conflict (id) do nothing;
insert into public.admins (user_id)
select user_id from public.admin_users
on conflict (user_id) do nothing;

-- Make the newer membership table authoritative while retaining admin_users for a safe transition.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    join public.profiles p on p.id = a.user_id
    where a.user_id = (select auth.uid()) and a.status = 'active' and p.status = 'active'
  ) or exists (
    select 1 from public.admin_users legacy
    where legacy.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Consistent lifecycle columns. Existing is_published columns remain for compatibility with old clients.
alter table public.course_sections add column if not exists status text not null default 'published';
alter table public.course_sections add column if not exists updated_at timestamptz not null default now();
alter table public.courses add column if not exists status text not null default 'published';
alter table public.courses add column if not exists sort_order integer not null default 0;
alter table public.banners add column if not exists status text not null default 'published';
alter table public.banners add column if not exists updated_at timestamptz not null default now();
alter table public.quizzes add column if not exists sort_order integer not null default 0;
alter table public.quiz_fields add column if not exists created_at timestamptz not null default now();
alter table public.quiz_fields add column if not exists updated_at timestamptz not null default now();
alter table public.quiz_fields add column if not exists status text not null default 'published';
alter table public.questions add column if not exists updated_at timestamptz not null default now();
alter table public.questions add column if not exists status text not null default 'published';
alter table public.question_options add column if not exists created_at timestamptz not null default now();
alter table public.question_options add column if not exists updated_at timestamptz not null default now();
alter table public.question_options add column if not exists status text not null default 'published';
alter table public.attempts add column if not exists updated_at timestamptz not null default now();
alter table public.answers add column if not exists created_at timestamptz not null default now();
alter table public.answers add column if not exists updated_at timestamptz not null default now();
alter table public.answers add column if not exists status text not null default 'active';
alter table public.quiz_result_blocks add column if not exists created_at timestamptz not null default now();
alter table public.quiz_result_blocks add column if not exists updated_at timestamptz not null default now();
alter table public.quiz_result_blocks add column if not exists status text not null default 'published';

update public.course_sections set status = case when is_published then 'published' else 'draft' end where status = 'published' and not is_published;
update public.courses set status = case when is_published then 'published' else 'draft' end where status = 'published' and not is_published;
update public.banners set status = case when is_published then 'published' else 'draft' end where status = 'published' and not is_published;
alter table public.course_sections drop constraint if exists course_sections_status_check;
alter table public.course_sections add constraint course_sections_status_check check (status in ('draft','published','archived'));
alter table public.banners drop constraint if exists banners_status_check;
alter table public.banners add constraint banners_status_check check (status in ('draft','published','archived'));
alter table public.courses drop constraint if exists courses_status_check;
alter table public.courses add constraint courses_status_check check (status in ('draft','published','archived'));
alter table public.quiz_fields drop constraint if exists quiz_fields_status_check;
alter table public.quiz_fields add constraint quiz_fields_status_check check (status in ('draft','published','archived'));
alter table public.questions drop constraint if exists questions_status_check;
alter table public.questions add constraint questions_status_check check (status in ('draft','published','archived'));
alter table public.question_options drop constraint if exists question_options_status_check;
alter table public.question_options add constraint question_options_status_check check (status in ('draft','published','archived'));
alter table public.answers drop constraint if exists answers_status_check;
alter table public.answers add constraint answers_status_check check (status in ('active','void'));
alter table public.quiz_result_blocks drop constraint if exists quiz_result_blocks_status_check;
alter table public.quiz_result_blocks add constraint quiz_result_blocks_status_check check (status in ('draft','published','archived'));

create table if not exists public.short_answer_accepted_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  answer text not null check (length(btrim(answer)) > 0),
  answer_normalized text not null check (length(answer_normalized) > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('draft','published','archived')),
  unique (question_id, answer_normalized)
);

alter table public.attempts add column if not exists participant_data_digest text;
alter table public.attempts add column if not exists session_token_hash text;
alter table public.attempts add column if not exists expires_at timestamptz;
alter table public.attempts add column if not exists question_snapshot jsonb not null default '{}'::jsonb;
alter table public.attempts add constraint attempts_expiry_valid check (expires_at is null or expires_at >= started_at);
alter table public.attempts add constraint attempts_session_token_unique unique (session_token_hash);

create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep all sort and lookup paths indexable and deterministic.
create index if not exists course_sections_status_order_idx on public.course_sections(status, sort_order, id);
create index if not exists banners_status_order_idx on public.banners(status, sort_order, id);
create index if not exists courses_published_order_idx on public.courses(status, is_published, sort_order, id);
create index if not exists quizzes_status_slug_idx on public.quizzes(status, slug);
create index if not exists fields_quiz_order_idx on public.quiz_fields(quiz_id, sort_order, id);
create index if not exists questions_quiz_order_idx on public.questions(quiz_id, sort_order, id);
create index if not exists options_question_order_idx on public.question_options(question_id, sort_order, id);
create index if not exists short_answers_question_order_idx on public.short_answer_accepted_answers(question_id, sort_order, id);
create index if not exists attempts_quiz_status_idx on public.attempts(quiz_id, status, created_at desc);
create unique index if not exists attempts_participant_digest_unique_idx on public.attempts(quiz_id, participant_data_digest) where participant_data_digest is not null and status = 'in_progress';
create index if not exists attempts_ranking_idx on public.attempts(quiz_id, score desc, duration_ms asc, submitted_at asc, id) where status = 'submitted';
create index if not exists answers_attempt_idx on public.answers(attempt_id, question_id);
create index if not exists result_blocks_quiz_order_idx on public.quiz_result_blocks(quiz_id, sort_order, id);

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','admins','course_sections','courses','banners','quizzes','quiz_fields','questions','question_options','short_answer_accepted_answers','attempts','answers','quiz_result_blocks','site_settings'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Public reads use safe views. The base quiz tables never grant anonymous SELECT.
drop view if exists public.published_quiz_fields, public.published_quiz_questions,
  public.published_question_options, public.published_quizzes;

-- These views are deliberately security-definer and expose an allowlisted DTO only.
-- The underlying tables remain revoked from anon/authenticated.
create view public.published_quizzes as
select id, slug, title, description, duration_minutes, attempt_limit, open_at, close_at,
       show_score, show_ranking, show_correct_answers, created_at, updated_at
from public.quizzes
where status = 'published' and (open_at is null or open_at <= now()) and (close_at is null or close_at > now());

create view public.published_quiz_fields as
select quiz_fields.id, quiz_fields.quiz_id, quiz_fields.label, quiz_fields.field_key, quiz_fields.field_type, quiz_fields.placeholder, quiz_fields.required, quiz_fields.sort_order
from public.quiz_fields
join public.quizzes q on q.id = quiz_fields.quiz_id
where q.status = 'published' and quiz_fields.status = 'published';

create view public.published_quiz_questions as
select questions.id, questions.quiz_id, questions.question_type, questions.content, questions.points, questions.sort_order
from public.questions
join public.quizzes q on q.id = questions.quiz_id
where q.status = 'published' and questions.status = 'published';

create view public.published_question_options as
select o.id, o.question_id, o.content, o.sort_order
from public.question_options o
join public.questions qn on qn.id = o.question_id
join public.quizzes q on q.id = qn.quiz_id
where q.status = 'published' and qn.status = 'published' and o.status = 'published';

grant select on public.published_quizzes, public.published_quiz_fields,
  public.published_quiz_questions, public.published_question_options to anon, authenticated;

-- RLS and grants: only published catalog/settings and safe views are public.
do $$
declare t text;
begin
  foreach t in array array['profiles','admins','course_sections','courses','banners','quizzes','quiz_fields','questions','question_options','short_answer_accepted_answers','attempts','answers','quiz_result_blocks','site_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('drop policy if exists public_published_read on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

grant select on public.course_sections, public.courses, public.banners, public.site_settings to anon, authenticated;
create policy public_published_read on public.course_sections for select to anon, authenticated
  using (status = 'published' and is_published = true);
create policy public_published_read on public.courses for select to anon, authenticated
  using (status = 'published' and is_published = true);
create policy public_published_read on public.banners for select to anon, authenticated
  using (status = 'published' and is_published = true);
create policy public_published_read on public.site_settings for select to anon, authenticated
  using (status = 'published' and is_public = true);

grant select on public.admins to authenticated;
drop policy if exists admin_membership_self on public.admins;
create policy admin_membership_self on public.admins for select to authenticated
  using (user_id = (select auth.uid()) and status = 'active');
grant select on public.profiles to authenticated;
drop policy if exists profile_self on public.profiles;
create policy profile_self on public.profiles for select to authenticated using (id = (select auth.uid()));

commit;
