begin;
-- Internal ranking primitive. No public table/view exposes participant data.
create function public.quiz_ranks(p_quiz uuid) returns table(attempt_id uuid, rank bigint)
language sql stable security definer set search_path='' as $$
 select id,row_number() over(order by score desc,duration_ms asc,submitted_at asc,id)
 from public.attempts where quiz_id=p_quiz and status='submitted';
$$;
revoke all on function public.quiz_ranks(uuid) from public,anon,authenticated,service_role;

create function public.admin_results(p_quiz uuid,p_op text,p_search text default '',p_page integer default 1,p_size integer default 25,p_attempt uuid default null)
returns text language plpgsql security definer set search_path='' as $$
declare q public.quizzes; v_attempt public.attempts; fields jsonb; rows jsonb; summary jsonb; total bigint; page_no integer; page_size integer;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 select * into q from public.quizzes where id=p_quiz;
 if not found then raise exception 'NOT_FOUND';end if;
 if p_op not in ('participants','leaderboard','detail','analytics','export') or p_op is null then raise exception 'INVALID_OPERATION';end if;
 if length(coalesce(p_search,''))>200 then raise exception 'INVALID_SEARCH';end if;
 select coalesce(jsonb_agg(jsonb_build_object('key',field_key,'label',label,'status',status,'show_on_leaderboard',show_on_leaderboard) order by sort_order,id),'[]') into fields from public.quiz_fields where quiz_id=q.id;
 if p_op='detail' then
  select * into v_attempt from public.attempts where id=p_attempt and quiz_id=q.id;
  if not found then raise exception 'NOT_FOUND';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','content',x->>'content','type',x->>'type','options',x->'options','points',x->'points','correct',case x->>'type' when 'multiple_choice' then x->'correct_option_id' when 'true_false' then x->'correct_boolean' else x->'accepted_answers' end,'answer',ans.answer_data->'value','is_correct',case when v_attempt.status='submitted' then ans.is_correct else null end,'points_awarded',case when v_attempt.status='submitted' then ans.points_awarded else null end) order by ord),'[]') into rows
  from jsonb_array_elements(v_attempt.question_snapshot->'questions') with ordinality s(x,ord) left join public.answers ans on ans.attempt_id=v_attempt.id and ans.question_id=(x->>'id')::uuid;
  return jsonb_build_object('quiz_id',q.id,'title',q.title,'fields',fields,'attempt',jsonb_build_object('id',v_attempt.id,'participant_data',v_attempt.participant_data,'status',v_attempt.status,'score',v_attempt.score,'max_score',v_attempt.max_score,'correct_count',v_attempt.correct_count,'wrong_count',v_attempt.wrong_count,'duration_ms',v_attempt.duration_ms,'submitted_at',v_attempt.submitted_at,'rank',(select rank from public.quiz_ranks(q.id) where attempt_id=v_attempt.id)),'questions',rows)::text;
 end if;
 if p_op='analytics' then
  select jsonb_build_object('participant_count',count(distinct coalesce(participant_data_digest,id::text)),'total_attempts',count(*),'completed_attempts',count(*) filter(where status='submitted'),'completion_rate',coalesce(round(100.0*(count(*) filter(where status='submitted'))/nullif(count(*),0),2),0),'average_score',avg(score) filter(where status='submitted'),'average_duration_ms',avg(duration_ms) filter(where status='submitted')) into summary from public.attempts where quiz_id=q.id;
  select coalesce(jsonb_agg(to_jsonb(t) order by position,id,content),'[]') into rows from (
   select x->>'id' id,x->>'content' content,min(ord) position,count(*) completed_count,count(*) filter(where ans.is_correct) correct_count,round(100.0*(count(*) filter(where ans.is_correct))/count(*),2) correct_rate
   from public.attempts a cross join lateral jsonb_array_elements(a.question_snapshot->'questions') with ordinality s(x,ord)
   left join public.answers ans on ans.attempt_id=a.id and ans.question_id=(x->>'id')::uuid
   where a.quiz_id=q.id and a.status='submitted' group by x->>'id',x->>'content'
  ) t;
  return jsonb_build_object('quiz_id',q.id,'title',q.title,'summary',summary,'questions',rows)::text;
 end if;
 page_size:=case when p_op='export' then 10000 else greatest(1,least(coalesce(p_size,25),100)) end;
 select count(*) into total from public.attempts a where a.quiz_id=q.id and (p_op<>'leaderboard' or a.status='submitted') and (coalesce(p_search,'')='' or strpos(lower(a.participant_data::text),lower(p_search))>0);
 if p_op='export' and total>10000 then raise exception 'EXPORT_TOO_LARGE';end if;
 page_no:=greatest(1,least(coalesce(p_page,1),greatest(1,ceil(total::numeric/page_size)::integer)));
 select coalesce(jsonb_agg(to_jsonb(t) order by rank nulls last,started_at desc,id),'[]') into rows from (
  select a.id,a.participant_data,a.status,case when a.status='submitted' then a.score else null end score,a.max_score,case when a.status='submitted' then a.correct_count else null end correct_count,case when a.status='submitted' then a.wrong_count else null end wrong_count,a.duration_ms,a.submitted_at,a.started_at,r.rank
  from public.attempts a left join public.quiz_ranks(q.id) r on r.attempt_id=a.id
  where a.quiz_id=q.id and (p_op<>'leaderboard' or a.status='submitted') and (coalesce(p_search,'')='' or strpos(lower(a.participant_data::text),lower(p_search))>0)
  order by r.rank nulls last,a.started_at desc,a.id limit page_size offset (page_no-1)*page_size
 ) t;
 return jsonb_build_object('quiz_id',q.id,'title',q.title,'revision',q.updated_at,'show_rank',q.show_ranking,'fields',fields,'rows',rows,'total',total,'page',page_no,'page_size',page_size)::text;
end;$$;
revoke all on function public.admin_results(uuid,text,text,integer,integer,uuid) from public,anon;
grant execute on function public.admin_results(uuid,text,text,integer,integer,uuid) to authenticated;

create function public.admin_leaderboard_settings(p_quiz uuid,p_revision timestamptz,p_enabled boolean,p_keys text[]) returns void
language plpgsql security definer set search_path='' as $$
declare q public.quizzes;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 select * into q from public.quizzes where id=p_quiz for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if p_revision is null or q.updated_at is distinct from p_revision then raise exception 'STALE_VERSION';end if;
 if p_enabled is null or p_keys is null or exists(select 1 from unnest(p_keys) k where not exists(select 1 from public.quiz_fields where quiz_id=q.id and field_key=k and status='published')) then raise exception 'INVALID_SETTINGS';end if;
 update public.quiz_fields set show_on_leaderboard=field_key=any(p_keys) where quiz_id=q.id;
 update public.quizzes set show_ranking=p_enabled where id=q.id;
end;$$;
revoke all on function public.admin_leaderboard_settings(uuid,timestamptz,boolean,text[]) from public,anon;
grant execute on function public.admin_leaderboard_settings(uuid,timestamptz,boolean,text[]) to authenticated;

alter function public.quiz_runtime(text,text) rename to quiz_runtime_v8;
revoke all on function public.quiz_runtime_v8(text,text) from public,anon,authenticated,service_role;
create function public.quiz_runtime(p_op text,p_payload text) returns text
language plpgsql security definer set search_path='' as $$
declare p jsonb:=p_payload::jsonb; q public.quizzes; result jsonb;
begin
 if p_op='leaderboard' then
  select * into q from public.quizzes where slug=p->>'slug' for share;
  if not found then raise exception 'NOT_FOUND';end if;
  if not exists(select 1 from public.quiz_access_sessions where quiz_id=q.id and token_hash=p->>'token_hash' and expires_at>clock_timestamp()) then raise exception 'ACCESS_REQUIRED';end if;
  if not q.show_ranking or q.status='draft' then return '[]';end if;
  select coalesce(jsonb_agg(jsonb_build_object('rank',r.rank,'name',coalesce(nullif(f.name,''),'Người tham gia'),'public_fields',coalesce(f.fields,'[]'::jsonb),'score',case when q.show_score then a.score else null end,'max_score',case when q.show_score then a.max_score else null end,'duration_ms',a.duration_ms) order by r.rank),'[]') into result
  from public.quiz_ranks(q.id) r join public.attempts a on a.id=r.attempt_id
  left join lateral (
   select jsonb_agg(jsonb_build_object('key',field_key,'label',label,'value',a.participant_data->field_key) order by sort_order,id) fields,string_agg(left(a.participant_data->>field_key,80),' · ' order by sort_order,id) name
   from public.quiz_fields where quiz_id=q.id and status='published' and show_on_leaderboard and jsonb_typeof(a.participant_data->field_key) in ('string','number','boolean','array')
  ) f on true where r.rank<=100;
  return result::text;
 end if;
 result:=public.quiz_runtime_v8(p_op,p_payload)::jsonb;
 -- Answer keys are now admin-only, even after closure or when legacy review is enabled.
 if p_op='result' then result:=result-'review';end if;
 return result::text;
end;$$;
revoke all on function public.quiz_runtime(text,text) from public,anon,authenticated;
grant execute on function public.quiz_runtime(text,text) to service_role;
commit;
