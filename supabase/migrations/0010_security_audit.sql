begin;
-- Defense against inherited/default privileges on sensitive objects.
revoke all on public.questions,public.question_options,public.short_answer_accepted_answers,public.attempts,public.answers,public.quiz_access_sessions,public.quiz_rate_limits,public.quiz_result_pages,public.quiz_result_blocks from public,anon,authenticated;
revoke all on public.published_quizzes,public.published_quiz_fields,public.published_quiz_questions,public.published_question_options from public,anon,authenticated;
revoke create on schema public from public,anon,authenticated;
revoke all on function public.set_updated_at(),public.lock_attempt_quiz() from public,anon,authenticated;
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id in ('homepage-banners','course-thumbnails');

alter function public.quiz_runtime(text,text) rename to quiz_runtime_v9;
revoke all on function public.quiz_runtime_v9(text,text) from public,anon,authenticated,service_role;
create function public.quiz_runtime(p_op text,p_payload text) returns text
language plpgsql security definer set search_path='' as $$
declare p jsonb; s public.quiz_access_sessions; allow_global boolean; allow_local boolean; qid uuid;
begin
 if p_payload is null or octet_length(p_payload)>150000 then raise exception 'PAYLOAD_TOO_LARGE';end if;
 p:=p_payload::jsonb;
 if jsonb_typeof(p) is distinct from 'object' or p_op is null or p_op not in ('inspect','rate','auth_rate','request_rate','session','access','unlock','start','get','save','submit','result','leaderboard') then raise exception 'INVALID_OPERATION';end if;
 if p_op='auth_rate' then
  if coalesce(p->>'account','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_OPERATION';end if;
  allow_global:=public.quiz_rate('admin-login:global',120,60);
  allow_local:=public.quiz_rate('admin-login:'||(p->>'account'),10,900);
  return jsonb_build_object('allowed',allow_global and allow_local)::text;
 end if;
 if coalesce(p->>'slug','') !~ '^[a-z0-9-]{1,160}$' then raise exception 'NOT_FOUND';end if;
 if p_op='rate' then
  -- A visitor can delete cookies, but cannot reset the shared per-quiz budget.
  allow_global:=public.quiz_rate('unlock:global',600,60);
  if not exists(select 1 from public.quizzes where slug=p->>'slug') then return '{"allowed":false}';end if;
  allow_local:=public.quiz_rate('unlock:quiz:'||(p->>'slug'),60,900);
  allow_local:=public.quiz_rate('visitor:'||(p->>'slug')||':'||left(p->>'visitor',64),8,900) and allow_local;
  return jsonb_build_object('allowed',allow_global and allow_local)::text;
 end if;
 if p_op in ('session','request_rate') then
  select a.* into s from public.quiz_access_sessions a join public.quizzes q on q.id=a.quiz_id where q.slug=p->>'slug' and a.token_hash=p->>'token_hash' and a.expires_at>clock_timestamp();
  if p_op='session' then return jsonb_build_object('ok',s.id is not null and s.visitor_digest=p->>'visitor')::text;end if;
  if s.id is null then raise exception 'ACCESS_REQUIRED';end if;
  allow_local:=public.quiz_rate('requests:'||s.id::text,240,60);
  return jsonb_build_object('allowed',allow_local)::text;
 end if;
 if p_op='unlock' then
  if coalesce(p->>'token_hash','') !~ '^[a-f0-9]{64}$' or length(coalesce(p->>'visitor','')) not between 1 and 64 then raise exception 'ACCESS_REQUIRED';end if;
  -- A guessed/chosen token cannot rebind an existing session to another quiz/visitor.
  select * into s from public.quiz_access_sessions where token_hash=p->>'token_hash';
  select id into qid from public.quizzes where slug=p->>'slug';
  if s.id is not null and (s.quiz_id<>qid or s.visitor_digest<>p->>'visitor') then raise exception 'ACCESS_REQUIRED';end if;
 end if;
 return public.quiz_runtime_v9(p_op,p_payload);
end;$$;
revoke all on function public.quiz_runtime(text,text) from public,anon,authenticated;
grant execute on function public.quiz_runtime(text,text) to service_role;
commit;
