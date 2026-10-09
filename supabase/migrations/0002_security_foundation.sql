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
