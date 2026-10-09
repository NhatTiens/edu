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


