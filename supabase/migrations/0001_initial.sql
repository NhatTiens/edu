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
