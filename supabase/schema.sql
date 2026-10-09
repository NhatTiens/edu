-- Fresh install: apply this file OR migrations 0001 through 0006, never both.
-- Reference schema for Work to apply/review before production.
create extension if not exists pgcrypto;

create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.course_sections(id) on delete set null,
  title text not null,
  slug text unique not null,
  thumbnail_url text,
  description text,
  category text,
  price integer,
  old_price integer,
  badge text,
  teacher_name text,
  teacher_link text,
  sort_order int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  button_text text,
  target_url text,
  open_new_tab boolean not null default true,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  slug text unique not null,
  description text,
  password_hash text,
  duration_minutes int,
  open_at timestamptz,
  close_at timestamptz,
  attempt_limit int,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  show_score boolean not null default true,
  show_ranking boolean not null default true,
  show_correct_answers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_fields (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  label text not null,
  field_key text not null,
  field_type text not null,
  placeholder text,
  required boolean not null default false,
  sort_order int not null default 0,
  settings jsonb not null default '{}'::jsonb,
  unique(quiz_id, field_key)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_type text not null check (question_type in ('multiple_choice','true_false','short_answer')),
  content text not null,
  points numeric not null default 1,
  sort_order int not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  content text not null,
  is_correct boolean not null default false,
  sort_order int not null default 0
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  participant_data jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_ms bigint,
  correct_count int,
  wrong_count int,
  score numeric,
  max_score numeric,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_data jsonb not null default '{}'::jsonb,
  is_correct boolean,
  points_awarded numeric,
  unique(attempt_id, question_id)
);

create table if not exists public.quiz_result_blocks (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  block_type text not null,
  title text,
  content text,
  url text,
  sort_order int not null default 0,
  visibility_rule jsonb not null default '{}'::jsonb
);

-- RLS baseline. Work should refine public read policies and owner checks before production.
alter table public.quizzes enable row level security;
alter table public.quiz_fields enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
alter table public.quiz_result_blocks enable row level security;

-- Apply after 0001_initial.sql. Back up existing data first; invalid legacy rows
-- intentionally make this transaction fail rather than being silently deleted.
begin;
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
create policy admin_membership_self on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.admin_users where user_id = (select auth.uid())); $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.courses add column theme text not null default 'orange'
  check (theme in ('orange','blue','green','cyan'));
alter table public.courses add constraint courses_prices_nonnegative
  check ((price is null or price >= 0) and (old_price is null or old_price >= 0));
alter table public.quizzes add constraint quiz_duration_positive check (duration_minutes is null or duration_minutes > 0);
alter table public.quizzes add constraint quiz_limit_positive check (attempt_limit is null or attempt_limit > 0);
alter table public.quizzes add constraint quiz_schedule_valid check (open_at is null or close_at is null or close_at > open_at);
alter table public.questions add constraint question_points_nonnegative check (points >= 0);
alter table public.attempts add constraint attempt_duration_nonnegative check (duration_ms is null or duration_ms >= 0);
alter table public.attempts add constraint attempt_time_valid check (submitted_at is null or submitted_at >= started_at);
alter table public.attempts add constraint attempt_score_valid check (score is null or (score >= 0 and max_score is not null and score <= max_score));

-- Prevent cross-quiz answer insertion with composite foreign keys.
alter table public.attempts add constraint attempts_id_quiz_unique unique (id, quiz_id);
alter table public.questions add constraint questions_id_quiz_unique unique (id, quiz_id);
alter table public.answers add column quiz_id uuid;
update public.answers a set quiz_id = t.quiz_id from public.attempts t where a.attempt_id = t.id;
alter table public.answers alter column quiz_id set not null;
alter table public.answers add constraint answers_attempt_quiz_fk foreign key (attempt_id, quiz_id) references public.attempts(id, quiz_id) on delete cascade;
alter table public.answers add constraint answers_question_quiz_fk foreign key (question_id, quiz_id) references public.questions(id, quiz_id) on delete cascade;

create index courses_section_order_idx on public.courses(section_id, sort_order);
create index fields_quiz_order_idx on public.quiz_fields(quiz_id, sort_order);
create index questions_quiz_order_idx on public.questions(quiz_id, sort_order);
create index options_question_order_idx on public.question_options(question_id, sort_order);
create index result_blocks_quiz_order_idx on public.quiz_result_blocks(quiz_id, sort_order);
create index attempts_ranking_idx on public.attempts(quiz_id, score desc, duration_ms asc, submitted_at asc) where status = 'submitted';

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger quizzes_updated_at before update on public.quizzes for each row execute function public.set_updated_at();

alter table public.course_sections enable row level security;
revoke all on public.course_sections from anon, authenticated;
grant select, insert, update, delete on public.course_sections to authenticated;
create policy admin_all on public.course_sections for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.courses enable row level security;
revoke all on public.courses from anon, authenticated;
grant select, insert, update, delete on public.courses to authenticated;
create policy admin_all on public.courses for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.banners enable row level security;
revoke all on public.banners from anon, authenticated;
grant select, insert, update, delete on public.banners to authenticated;
create policy admin_all on public.banners for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.quizzes enable row level security;
revoke all on public.quizzes from anon, authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
create policy admin_all on public.quizzes for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.quiz_fields enable row level security;
revoke all on public.quiz_fields from anon, authenticated;
grant select, insert, update, delete on public.quiz_fields to authenticated;
create policy admin_all on public.quiz_fields for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.questions enable row level security;
revoke all on public.questions from anon, authenticated;
grant select, insert, update, delete on public.questions to authenticated;
create policy admin_all on public.questions for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.question_options enable row level security;
revoke all on public.question_options from anon, authenticated;
grant select, insert, update, delete on public.question_options to authenticated;
create policy admin_all on public.question_options for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.attempts enable row level security;
revoke all on public.attempts from anon, authenticated;
grant select, insert, update, delete on public.attempts to authenticated;
create policy admin_all on public.attempts for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.answers enable row level security;
revoke all on public.answers from anon, authenticated;
grant select, insert, update, delete on public.answers to authenticated;
create policy admin_all on public.answers for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.quiz_result_blocks enable row level security;
revoke all on public.quiz_result_blocks from anon, authenticated;
grant select, insert, update, delete on public.quiz_result_blocks to authenticated;
create policy admin_all on public.quiz_result_blocks for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.course_sections to anon;
create policy published_read on public.course_sections for select to anon, authenticated using (is_published = true);

grant select on public.courses to anon;
create policy published_read on public.courses for select to anon, authenticated using (is_published = true);

grant select on public.banners to anon;
create policy published_read on public.banners for select to anon, authenticated using (is_published = true);

-- No anonymous access to quizzes, questions, options, attempts or answers.
-- Public quiz services must expose explicit safe DTOs, never select('*').
-- Administrator membership is provisioned via trusted SQL only, never signup metadata.
commit;

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

begin;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
select exists(select 1 from public.admins a join public.profiles p on p.id=a.user_id
where a.user_id=(select auth.uid()) and a.status='active' and p.status='active');
$$;
grant select, insert, update, delete on public.courses, public.course_sections, public.banners to authenticated;
drop policy if exists published_read on public.courses;
drop policy if exists published_read on public.course_sections;
drop policy if exists published_read on public.banners;
drop policy public_published_read on public.courses;
create policy public_published_read on public.courses for select to anon, authenticated using
(status='published' and is_published and (section_id is null or exists
(select 1 from public.course_sections s where s.id=section_id and s.status='published' and s.is_published)));

alter table public.courses add column if not exists course_link text;
alter table public.courses add constraint courses_course_link_valid check (course_link is null or course_link ~* '^(https?://|/)');

-- Storage buckets are private by default. Public homepage assets use immutable public URLs;
-- writes remain admin-only through Storage RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('homepage-banners', 'homepage-banners', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
  ('course-thumbnails', 'course-thumbnails', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists homepage_assets_read on storage.objects;
create policy homepage_assets_read on storage.objects for select to anon, authenticated
using (bucket_id in ('homepage-banners','course-thumbnails'));
drop policy if exists homepage_assets_admin_insert on storage.objects;
create policy homepage_assets_admin_insert on storage.objects for insert to authenticated
with check (bucket_id in ('homepage-banners','course-thumbnails') and (select public.is_admin()));
drop policy if exists homepage_assets_admin_update on storage.objects;
create policy homepage_assets_admin_update on storage.objects for update to authenticated
using (bucket_id in ('homepage-banners','course-thumbnails') and (select public.is_admin()))
with check (bucket_id in ('homepage-banners','course-thumbnails') and (select public.is_admin()));
drop policy if exists homepage_assets_admin_delete on storage.objects;
create policy homepage_assets_admin_delete on storage.objects for delete to authenticated
using (bucket_id in ('homepage-banners','course-thumbnails') and (select public.is_admin()));

commit;

begin;
alter table public.quiz_fields add column is_identifier boolean not null default false;
alter table public.quiz_fields add column show_on_leaderboard boolean not null default false;
alter table public.quiz_fields add column options jsonb not null default '[]';
alter table public.questions add column case_insensitive boolean not null default true;
alter table public.quiz_fields add constraint field_type_supported check(field_type in ('text','number','email','url','select','radio','checkbox','textarea'));
alter table public.quiz_fields add constraint field_options_array check(jsonb_typeof(options)='array');
alter table public.quiz_fields add constraint field_identifier_valid check(not is_identifier or (required and field_type in ('text','number','email')));
create unique index quiz_one_identifier on public.quiz_fields(quiz_id) where is_identifier;

-- Explicit allowlist; never include settings/correctness in public question views.
create or replace view public.published_quiz_fields as
select f.id,f.quiz_id,f.label,f.field_key,f.field_type,f.placeholder,f.required,f.sort_order,f.options
from public.quiz_fields f join public.quizzes q on q.id=f.quiz_id
where f.status='published' and q.status='published';

create function public.admin_quiz_document(p_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare doc jsonb;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 select jsonb_build_object('id',q.id,'updated_at',q.updated_at,'title',q.title,'slug',q.slug,'description',coalesce(q.description,''),
 'duration_minutes',q.duration_minutes,'attempt_limit',q.attempt_limit,'open_at',coalesce(q.open_at::text,''),'close_at',coalesce(q.close_at::text,''),'status',q.status,
 'show_score',q.show_score,'show_rank',q.show_ranking,'show_correct_answers',q.show_correct_answers,'has_password',q.password_hash is not null,'password','','remove_password',false,
 'fields',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'label',f.label,'key',f.field_key,'type',f.field_type,'placeholder',coalesce(f.placeholder,''),'required',f.required,'options',f.options,'sort_order',f.sort_order,'is_identifier',f.is_identifier,'show_on_leaderboard',f.show_on_leaderboard) order by f.sort_order,f.id) from public.quiz_fields f where f.quiz_id=q.id),'[]'),
 'questions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'type',x.question_type,'content',x.content,'points',x.points,'sort_order',x.sort_order,'case_insensitive',x.case_insensitive,
 'options',case when x.question_type='multiple_choice' then coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'content',o.content) order by o.sort_order,o.id) from public.question_options o where o.question_id=x.id),'[]') else '[]'::jsonb end,
 'correct_option_id',coalesce((select o.id::text from public.question_options o where o.question_id=x.id and o.is_correct limit 1),''),
 'correct_boolean',coalesce((select o.is_correct from public.question_options o where o.question_id=x.id order by o.sort_order,o.id limit 1),false),
 'accepted_answers',coalesce((select jsonb_agg(a.answer order by a.sort_order,a.id) from public.short_answer_accepted_answers a where a.question_id=x.id),'[]')) order by x.sort_order,x.id) from public.questions x where x.quiz_id=q.id),'[]')) into doc from public.quizzes q where q.id=p_id;
 return doc::text;
end;$$;

create function public.admin_save_quiz(p_document text, p_password_hash text default null, p_remove_password boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare d jsonb:=p_document::jsonb; qid uuid; old public.quizzes; f jsonb; x jsonb; a jsonb; n int; answer_position int; normalized text;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if octet_length(p_document)>1000000 then raise exception 'PAYLOAD_TOO_LARGE';end if;
 if d ? 'password' or d ? 'password_hash' then raise exception 'PASSWORD_MUST_BE_HASHED_SERVER_SIDE';end if;
 if p_password_hash is not null and p_password_hash !~ '^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'INVALID_PASSWORD_HASH';end if;
 if coalesce(length(btrim(d->>'title')),0)=0 or (d->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'INVALID_QUIZ';end if;
 if jsonb_typeof(d->'fields')<>'array' or jsonb_typeof(d->'questions')<>'array' or jsonb_array_length(d->'fields')>50 or jsonb_array_length(d->'questions')>200 then raise exception 'INVALID_CHILDREN';end if;
 if d->>'status'='published' and jsonb_array_length(d->'questions')=0 then raise exception 'QUESTIONS_REQUIRED';end if;
 qid:=nullif(d->>'id','')::uuid;
 if qid is not null then
  select * into old from public.quizzes where id=qid for update;
  if not found then raise exception 'QUIZ_NOT_FOUND';end if;
  if old.updated_at is distinct from (d->>'updated_at')::timestamptz then raise exception 'STALE_VERSION';end if;
  -- Until attempt snapshots are implemented, never mutate a quiz with participant history.
  if exists(select 1 from public.attempts where quiz_id=qid) then
   if p_password_hash is null and not p_remove_password and
    (d - array['status','show_score','show_rank','show_correct_answers']) =
    (public.admin_quiz_document(qid)::jsonb - array['password','has_password','remove_password','status','show_score','show_rank','show_correct_answers']) then
     update public.quizzes set status=d->>'status',show_score=(d->>'show_score')::boolean,show_ranking=(d->>'show_rank')::boolean,show_correct_answers=(d->>'show_correct_answers')::boolean where id=qid;
     return qid;
   end if;
   raise exception 'QUIZ_HAS_ATTEMPTS';
  end if;
 else
  qid:=gen_random_uuid();
  insert into public.quizzes(id,title,slug,owner_id)values(qid,d->>'title',d->>'slug',auth.uid());
 end if;
 update public.quizzes set title=d->>'title',slug=d->>'slug',description=d->>'description',duration_minutes=(d->>'duration_minutes')::int,attempt_limit=(d->>'attempt_limit')::int,
 open_at=nullif(d->>'open_at','')::timestamptz,close_at=nullif(d->>'close_at','')::timestamptz,status=d->>'status',show_score=(d->>'show_score')::boolean,show_ranking=(d->>'show_rank')::boolean,show_correct_answers=(d->>'show_correct_answers')::boolean,
 password_hash=case when p_remove_password then null when p_password_hash is not null then p_password_hash else password_hash end where id=qid;
 delete from public.quiz_fields where quiz_id=qid;
 delete from public.questions where quiz_id=qid;
 n:=0;
 for f in select value from jsonb_array_elements(d->'fields') loop
  if coalesce(length(btrim(f->>'label')),0)=0 or (f->>'key') !~ '^[a-z][a-z0-9_]{0,63}$' then raise exception 'INVALID_FIELD';end if;
  if f->>'type' in ('select','radio','checkbox') and jsonb_array_length(f->'options')=0 then raise exception 'FIELD_OPTIONS_REQUIRED';end if;
  insert into public.quiz_fields(id,quiz_id,label,field_key,field_type,placeholder,required,options,sort_order,is_identifier,show_on_leaderboard)
  values((f->>'id')::uuid,qid,f->>'label',f->>'key',f->>'type',f->>'placeholder',(f->>'required')::boolean,f->'options',n,(f->>'is_identifier')::boolean,(f->>'show_on_leaderboard')::boolean);n:=n+1;
 end loop;
 n:=0;
 for x in select value from jsonb_array_elements(d->'questions') loop
  if coalesce(length(btrim(x->>'content')),0)=0 then raise exception 'QUESTION_CONTENT_REQUIRED';end if;
  insert into public.questions(id,quiz_id,question_type,content,points,sort_order,case_insensitive)values((x->>'id')::uuid,qid,x->>'type',x->>'content',(x->>'points')::numeric,n,(x->>'case_insensitive')::boolean);n:=n+1;
  if x->>'type'='multiple_choice' then
   if jsonb_array_length(x->'options')<2 or (select count(*) from jsonb_array_elements(x->'options') v where v->>'id'=x->>'correct_option_id')<>1 then raise exception 'ONE_CORRECT_OPTION_REQUIRED';end if;
   insert into public.question_options(id,question_id,content,is_correct,sort_order)
   select (v->>'id')::uuid,(x->>'id')::uuid,v->>'content',v->>'id'=x->>'correct_option_id',ord-1 from jsonb_array_elements(x->'options') with ordinality as opt(v,ord);
  elsif x->>'type'='true_false' then
   insert into public.question_options(question_id,content,is_correct,sort_order)values((x->>'id')::uuid,'Đúng',(x->>'correct_boolean')::boolean,0),((x->>'id')::uuid,'Sai',not (x->>'correct_boolean')::boolean,1);
  else
   if jsonb_array_length(x->'accepted_answers')=0 then raise exception 'ACCEPTED_ANSWERS_REQUIRED';end if;
   answer_position:=0;
   for a in select value from jsonb_array_elements(x->'accepted_answers') loop
    normalized:=btrim(a#>>'{}');if (x->>'case_insensitive')::boolean then normalized:=lower(normalized);end if;
    insert into public.short_answer_accepted_answers(question_id,answer,answer_normalized,sort_order)values((x->>'id')::uuid,btrim(a#>>'{}'),normalized,answer_position);
    answer_position:=answer_position+1;
   end loop;
  end if;
 end loop;
 return qid;
end;$$;
revoke all on function public.admin_quiz_document(uuid),public.admin_save_quiz(text,text,boolean) from public,anon;
grant execute on function public.admin_quiz_document(uuid),public.admin_save_quiz(text,text,boolean) to authenticated;
grant select on public.quizzes to authenticated;
-- All builder writes go through one locked transaction; no partial option replacement.
revoke insert,update,delete on public.quizzes,public.quiz_fields,public.questions,public.question_options,public.short_answer_accepted_answers from authenticated;
-- Serialize attempt creation against builder edits on the same quiz.
create function public.lock_attempt_quiz() returns trigger language plpgsql set search_path='' as $$
begin perform 1 from public.quizzes where id=new.quiz_id for update;return new;end;$$;
create trigger attempt_quiz_lock before insert or update of quiz_id on public.attempts for each row execute function public.lock_attempt_quiz();
commit;


begin;
-- No direct participant access to quiz tables/views, including authenticated non-admins.
revoke all on public.published_quizzes,public.published_quiz_fields,public.published_quiz_questions,public.published_question_options from anon,authenticated;
create table public.quiz_access_sessions(
 id uuid primary key default gen_random_uuid(),quiz_id uuid not null references public.quizzes(id) on delete cascade,
 token_hash text not null unique check(length(token_hash)=64), visitor_digest text not null, quiz_revision timestamptz not null,
 unlocked_until timestamptz not null default now()+interval '1 hour', expires_at timestamptz not null default now()+interval '30 days',created_at timestamptz not null default now()
);
create table public.quiz_rate_limits(key text primary key, window_start timestamptz not null, hits int not null);
alter table public.quiz_access_sessions enable row level security;
alter table public.quiz_rate_limits enable row level security;
revoke all on public.quiz_access_sessions,public.quiz_rate_limits from public,anon,authenticated;
create index quiz_sessions_expiry on public.quiz_access_sessions(expires_at);
alter table public.attempts add column access_session_id uuid references public.quiz_access_sessions(id) on delete restrict;
alter table public.attempts add column start_request_id uuid;
create unique index attempts_start_idempotency on public.attempts(access_session_id,start_request_id);
alter table public.attempts add column timed_out boolean not null default false;
create index attempts_session_idx on public.attempts(access_session_id,created_at desc);
create index attempts_identity_count_idx on public.attempts(quiz_id,participant_data_digest);
create index attempts_ranking_v2 on public.attempts(quiz_id,score desc,duration_ms,submitted_at,id) where status='submitted';

create function public.quiz_rate(p_key text,p_limit int,p_seconds int) returns boolean
language plpgsql security definer set search_path='' as $$
declare hits_now int;
begin
 insert into public.quiz_rate_limits as r values(p_key,clock_timestamp(),1)
 on conflict(key) do update set hits=case when r.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then 1 else r.hits+1 end,
 window_start=case when r.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else r.window_start end returning hits into hits_now;
 return hits_now<=p_limit;
end;$$;

create function public.quiz_safe_questions(p_snapshot jsonb) returns jsonb language sql immutable set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','type',x->'type','content',x->'content','points',x->'points','options',x->'options') order by ord),'[]')
from jsonb_array_elements(p_snapshot->'questions') with ordinality a(x,ord);
$$;
create function public.quiz_normalize(p_value text,p_insensitive boolean) returns text language sql immutable set search_path='' as $$
select case when p_insensitive then lower(regexp_replace(normalize(p_value,NFC),'^[[:space:] ]+|[[:space:] ]+$','','g')) else regexp_replace(normalize(p_value,NFC),'^[[:space:] ]+|[[:space:] ]+$','','g') end;
$$;

-- Called only by service-role runtime, under an attempt lock. Ignores client grades/timestamps.
create function public.quiz_finalize(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.attempts; q jsonb; v jsonb; correct boolean; total numeric:=0; maximum numeric:=0; corrects int:=0; countq int:=0; submitted timestamptz:=clock_timestamp();
begin
 select * into a from public.attempts where id=p_id for update;
 if a.status<>'in_progress' then return;end if;
 for q in select value from jsonb_array_elements(a.question_snapshot->'questions') loop
  select answer_data->'value' into v from public.answers where attempt_id=a.id and question_id=(q->>'id')::uuid;
  correct:=false;maximum:=maximum+(q->>'points')::numeric;countq:=countq+1;
  if q->>'type'='multiple_choice' then correct:=coalesce(v=q->'correct_option_id',false);
  elsif q->>'type'='true_false' then correct:=coalesce(jsonb_typeof(v)='boolean' and v=q->'correct_boolean',false);
  elsif jsonb_typeof(v)='string' and length(public.quiz_normalize(v#>>'{}',false))>0 then
   correct:=exists(select 1 from jsonb_array_elements_text(q->'accepted_answers') aa(value) where public.quiz_normalize(aa.value,(q->>'case_insensitive')::boolean)=public.quiz_normalize(v#>>'{}',(q->>'case_insensitive')::boolean));
  end if;
  if correct then corrects:=corrects+1;total:=total+(q->>'points')::numeric;end if;
  insert into public.answers(attempt_id,quiz_id,question_id,answer_data,is_correct,points_awarded)
  values(a.id,a.quiz_id,(q->>'id')::uuid,jsonb_build_object('value',v),correct,case when correct then (q->>'points')::numeric else 0 end)
  on conflict(attempt_id,question_id) do update set is_correct=excluded.is_correct,points_awarded=excluded.points_awarded;
 end loop;
 update public.attempts set status='submitted',submitted_at=submitted,duration_ms=floor(extract(epoch from (submitted-started_at))*1000),score=total,max_score=maximum,correct_count=corrects,wrong_count=countq-corrects,timed_out=(expires_at is not null and submitted>=expires_at) where id=a.id;
end;$$;

create function public.quiz_runtime(p_op text,p_payload text) returns text
language plpgsql security definer set search_path='' as $$
declare p jsonb:=p_payload::jsonb; q public.quizzes; s public.quiz_access_sessions; a public.attempts; fields jsonb; questions jsonb; snap jsonb; r jsonb; submitted_field record; v jsonb; chosen jsonb; total int; current_time_server timestamptz; state text; name text; aid uuid; rank_value bigint; deadline timestamptz;
begin
 if octet_length(p_payload)>150000 then raise exception 'PAYLOAD_TOO_LARGE';end if;
 if p_op='rate' then
  delete from public.quiz_rate_limits where key in (select key from public.quiz_rate_limits where window_start<clock_timestamp()-interval '1 day' limit 100);
  -- Changes must commit even on denial; return a value, never raise after incrementing.
  return jsonb_build_object('allowed',public.quiz_rate('visitor:'||(p->>'slug')||':'||(p->>'visitor'),8,900) and public.quiz_rate('global:'||(p->>'slug'),120,60))::text;
 end if;
 select * into q from public.quizzes where slug=p->>'slug';
 if not found then raise exception 'NOT_FOUND';end if;
 -- Lock quiz before attempt, consistently with start/admin edits. Closing a quiz
 -- cannot race an answer write using stale status, and there is no lock inversion.
 if p_op not in ('inspect','start') then
  select * into q from public.quizzes where id=q.id for share;
 end if;
 current_time_server:=clock_timestamp();
 state:=case when q.status='draft' then 'draft' when q.status='closed' or q.close_at<=current_time_server then 'closed' when q.open_at>current_time_server then 'scheduled' else 'published' end;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'label',f.label,'key',f.field_key,'type',f.field_type,'placeholder',coalesce(f.placeholder,''),'required',f.required,'options',f.options,'sort_order',f.sort_order,'is_identifier',f.is_identifier,'show_on_leaderboard',f.show_on_leaderboard) order by f.sort_order,f.id),'[]') into fields from public.quiz_fields f where quiz_id=q.id and status='published';
 if p_op='inspect' then return jsonb_build_object('id',q.id,'title',q.title,'slug',q.slug,'description',q.description,'state',state,'revision',q.updated_at,'password_hash',q.password_hash,'duration_minutes',q.duration_minutes,'attempt_limit',q.attempt_limit,'open_at',q.open_at,'close_at',q.close_at,'fields',fields)::text;end if;
 if p_op='unlock' then
  if state<>'published' then raise exception 'QUIZ_UNAVAILABLE';end if;
  if q.updated_at is distinct from (p->>'revision')::timestamptz then raise exception 'QUIZ_CHANGED';end if;
  insert into public.quiz_access_sessions(quiz_id,token_hash,visitor_digest,quiz_revision) values(q.id,p->>'token_hash',p->>'visitor',q.updated_at) on conflict(token_hash) do update set quiz_revision=excluded.quiz_revision,unlocked_until=clock_timestamp()+interval '1 hour',expires_at=clock_timestamp()+interval '30 days';
  return '{"ok":true}';
 end if;
 select * into s from public.quiz_access_sessions where quiz_id=q.id and token_hash=p->>'token_hash' and expires_at>current_time_server;
 if p_op='access' then return jsonb_build_object('ok',s.id is not null and s.unlocked_until>current_time_server and s.quiz_revision=q.updated_at)::text;end if;
 if s.id is null then raise exception 'ACCESS_REQUIRED';end if;
 if p_op='start' then
  -- Serialize count + creation with admin edits and other start requests.
  select * into q from public.quizzes where id=q.id for update;
  current_time_server:=clock_timestamp();
  if q.status<>'published' or q.open_at>current_time_server or q.close_at<=current_time_server then raise exception 'QUIZ_UNAVAILABLE';end if;
  if s.unlocked_until<=current_time_server or s.quiz_revision<>q.updated_at or (p->>'revision')::timestamptz<>q.updated_at then raise exception 'QUIZ_CHANGED';end if;
  -- Retry with the same session resumes exactly the same attempt, including after submission.
  select id into aid from public.attempts where access_session_id=s.id and start_request_id=(p->>'request_id')::uuid;
  if aid is null then
   select id into aid from public.attempts where access_session_id=s.id and status='in_progress' order by created_at desc limit 1;
  end if;
  if aid is not null then return jsonb_build_object('id',aid)::text;end if;
  if length(coalesce(p->>'identity',''))<>64 or jsonb_typeof(p->'participant')<>'object' then raise exception 'INVALID_PARTICIPANT';end if;
  for a in select * from public.attempts where quiz_id=q.id and participant_data_digest=p->>'identity' and status='in_progress' and expires_at<=current_time_server for update loop
   perform public.quiz_finalize(a.id);
  end loop;
  select count(*) into total from public.attempts where quiz_id=q.id and participant_data_digest=p->>'identity';
  if q.attempt_limit is not null and total>=q.attempt_limit then raise exception 'ATTEMPT_LIMIT';end if;
  -- One active attempt per identity even when limit is unlimited; never transfer ownership.
  if exists(select 1 from public.attempts where quiz_id=q.id and participant_data_digest=p->>'identity' and status='in_progress') then raise exception 'ACTIVE_ATTEMPT';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'type',x.question_type,'content',x.content,'points',x.points,'case_insensitive',x.case_insensitive,
   'options',case when x.question_type='short_answer' then '[]'::jsonb when x.question_type='true_false' then '[{"id":"true","content":"Đúng"},{"id":"false","content":"Sai"}]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'content',o.content) order by o.sort_order,o.id) from public.question_options o where o.question_id=x.id and o.status='published'),'[]') end,
   'correct_option_id',(select o.id from public.question_options o where o.question_id=x.id and o.is_correct and o.status='published' limit 1),
   'correct_boolean',coalesce((select o.is_correct from public.question_options o where o.question_id=x.id order by o.sort_order,o.id limit 1),false),
   'accepted_answers',coalesce((select jsonb_agg(aa.answer order by aa.sort_order,aa.id) from public.short_answer_accepted_answers aa where aa.question_id=x.id and aa.status='published'),'[]')) order by x.sort_order,x.id),'[]') into questions from public.questions x where x.quiz_id=q.id and x.status='published';
  if jsonb_array_length(questions)=0 then raise exception 'EMPTY_QUIZ';end if;
  -- Only explicitly selected leaderboard fields are copied into a public display name.
  select string_agg(left(p->'participant'->>(z->>'key'),80),' · ' order by ord) into name from jsonb_array_elements(fields) with ordinality ff(z,ord) where (z->>'show_on_leaderboard')::boolean and jsonb_typeof(p->'participant'->(z->>'key'))='string';
  snap:=jsonb_build_object('questions',questions,'display_name',coalesce(nullif(name,''),'Người tham gia'));
  deadline:=least(q.close_at,case when q.duration_minutes is null then null else current_time_server+make_interval(mins=>q.duration_minutes) end);
  insert into public.attempts(quiz_id,participant_data,participant_data_digest,access_session_id,started_at,expires_at,question_snapshot,start_request_id)
  values(q.id,p->'participant',p->>'identity',s.id,current_time_server,deadline,snap,(p->>'request_id')::uuid) returning id into aid;
  return jsonb_build_object('id',aid)::text;
 end if;
 if p_op='leaderboard' then
  if not q.show_ranking or q.status='draft' then return '[]';end if;
  select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'name',display_name,'score',case when q.show_score then score else null end,'max_score',case when q.show_score then max_score else null end,'duration_ms',duration_ms) order by rank),'[]') into r
  from (select row_number()over(order by score desc,duration_ms asc,submitted_at asc,id) rank,question_snapshot->>'display_name' display_name,score,max_score,duration_ms from public.attempts where quiz_id=q.id and status='submitted' order by score desc,duration_ms asc,submitted_at asc,id limit 100) ranked;
  return r::text;
 end if;
 select * into a from public.attempts where id=(p->>'attempt_id')::uuid and quiz_id=q.id and access_session_id=s.id for update;
 if not found then raise exception 'ATTEMPT_NOT_FOUND';end if;
 current_time_server:=clock_timestamp();deadline:=least(a.expires_at,q.close_at);
 if a.status='in_progress' and (deadline<=current_time_server or q.status<>'published') then
  -- Late requests cannot inject answers; only the last server-saved draft is graded.
  perform public.quiz_finalize(a.id);
  select * into a from public.attempts where id=a.id;
 end if;
 if p_op in ('save','submit') and a.status='in_progress' then
  if jsonb_typeof(p->'answers')<>'object' then raise exception 'INVALID_ANSWERS';end if;
  for submitted_field in select * from jsonb_each(p->'answers') loop
   select value into chosen from jsonb_array_elements(a.question_snapshot->'questions') where value->>'id'=submitted_field.key;
   if chosen is null then raise exception 'INVALID_QUESTION';end if;
   v:=submitted_field.value;
   if v<>'null'::jsonb then
    if chosen->>'type'='true_false' and jsonb_typeof(v)<>'boolean' then raise exception 'INVALID_ANSWER';end if;
    if chosen->>'type' in ('multiple_choice','short_answer') and (jsonb_typeof(v)<>'string' or length(v#>>'{}')>2000) then raise exception 'INVALID_ANSWER';end if;
    if chosen->>'type'='multiple_choice' and not exists(select 1 from jsonb_array_elements(chosen->'options') opt where opt->>'id'=v#>>'{}') then raise exception 'INVALID_OPTION';end if;
   end if;
   insert into public.answers(attempt_id,quiz_id,question_id,answer_data)values(a.id,q.id,submitted_field.key::uuid,jsonb_build_object('value',v)) on conflict(attempt_id,question_id)do update set answer_data=excluded.answer_data;
  end loop;
  if p_op='submit' then perform public.quiz_finalize(a.id);end if;
  select * into a from public.attempts where id=a.id;
 end if;
 if p_op not in ('get','save','submit','result') then raise exception 'INVALID_OPERATION';end if;
 if p_op='result' and a.status='submitted' then
  select rank into rank_value from(select id,row_number()over(order by score desc,duration_ms asc,submitted_at asc,id) rank from public.attempts where quiz_id=q.id and status='submitted') ranked where id=a.id;
  r:=jsonb_build_object('id',a.id,'title',q.title,'status',a.status,'started_at',a.started_at,'submitted_at',a.submitted_at,'duration_ms',a.duration_ms,'timed_out',a.timed_out,'show_rank',q.show_ranking,'rank',case when q.show_ranking then rank_value else null end,'score',case when q.show_score then a.score else null end,'max_score',case when q.show_score then a.max_score else null end,'correct_count',case when q.show_score then a.correct_count else null end,'wrong_count',case when q.show_score then a.wrong_count else null end);
  -- Release answer keys only to the attempt owner after submission AND quiz closure.
  if q.show_correct_answers and (q.status='closed' or q.close_at<=clock_timestamp()) then
   select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','content',x->>'content','type',x->>'type','options',x->'options','correct',case x->>'type' when 'multiple_choice' then x->'correct_option_id' when 'true_false' then x->'correct_boolean' else x->'accepted_answers' end) order by ord),'[]') into questions from jsonb_array_elements(a.question_snapshot->'questions') with ordinality ss(x,ord);
   r:=r||jsonb_build_object('review',questions);
  end if;
  return r::text;
 end if;
 select coalesce(jsonb_object_agg(question_id::text,answer_data->'value'),'{}') into r from public.answers where attempt_id=a.id;
 return jsonb_build_object('id',a.id,'title',q.title,'status',a.status,'started_at',a.started_at,'expires_at',deadline,'server_now',clock_timestamp(),'questions',case when a.status='in_progress' then public.quiz_safe_questions(a.question_snapshot) else '[]'::jsonb end,'answers',r)::text;
end;$$;
revoke all on function public.quiz_runtime(text,text),public.quiz_finalize(uuid),public.quiz_rate(text,int,int),public.quiz_safe_questions(jsonb),public.quiz_normalize(text,boolean) from public,anon,authenticated;
grant execute on function public.quiz_runtime(text,text) to service_role;
commit;




