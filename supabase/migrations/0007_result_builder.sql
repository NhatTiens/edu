begin;
create table public.quiz_result_pages(
 quiz_id uuid primary key references public.quizzes(id) on delete cascade,
 revision bigint not null default 0,
 show_percentage boolean not null default true,
 show_correct_count boolean not null default true,
 show_wrong_count boolean not null default true,
 show_duration boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.quiz_result_pages enable row level security;
revoke all on public.quiz_result_pages from public,anon,authenticated;
create trigger quiz_result_pages_updated before update on public.quiz_result_pages for each row execute function public.set_updated_at();
alter table public.quiz_result_blocks add column visibility text not null default 'after_submit' check(visibility in ('after_submit','after_quiz_closed','scheduled_at'));
alter table public.quiz_result_blocks add column scheduled_at timestamptz;
alter table public.quiz_result_blocks add constraint result_schedule_required check(visibility<>'scheduled_at' or scheduled_at is not null);
revoke all on public.quiz_result_blocks from anon,authenticated;

create function public.admin_result_document(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare d jsonb;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 select jsonb_build_object('quiz_id',q.id,'title',q.title,'revision',coalesce(r.revision,0),'show_score',q.show_score,'show_rank',q.show_ranking,'show_correct_answers',q.show_correct_answers,
 'show_percentage',coalesce(r.show_percentage,true),'show_correct_count',coalesce(r.show_correct_count,true),'show_wrong_count',coalesce(r.show_wrong_count,true),'show_duration',coalesce(r.show_duration,true),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'type',b.block_type,'title',coalesce(b.title,''),'content',coalesce(b.content,''),'url',coalesce(b.url,''),'visibility',b.visibility,'scheduled_at',coalesce(b.scheduled_at::text,'')) order by b.sort_order,b.id) from public.quiz_result_blocks b where b.quiz_id=q.id),'[]')) into d from public.quizzes q left join public.quiz_result_pages r on r.quiz_id=q.id where q.id=p_id;
 return d::text;
end;$$;
create function public.admin_save_result(p_document text) returns bigint language plpgsql security definer set search_path='' as $$
declare d jsonb:=p_document::jsonb; qid uuid:=(d->>'quiz_id')::uuid; current_revision bigint; b jsonb; position int:=0;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if octet_length(p_document)>1000000 or jsonb_typeof(d->'blocks')<>'array' or jsonb_array_length(d->'blocks')>100 then raise exception 'INVALID_BLOCKS';end if;
 insert into public.quiz_result_pages(quiz_id)values(qid)on conflict do nothing;
 select revision into current_revision from public.quiz_result_pages where quiz_id=qid for update;
 if current_revision<>(d->>'revision')::bigint then raise exception 'STALE_VERSION';end if;
 delete from public.quiz_result_blocks where quiz_id=qid;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  if b->>'type' not in ('text','youtube','external_link','button','image') then raise exception 'INVALID_BLOCK_TYPE';end if;
  if b->>'type'='youtube' and (b->>'url') !~ '^https://www\.youtube-nocookie\.com/embed/[A-Za-z0-9_-]{11}$' then raise exception 'INVALID_YOUTUBE';end if;
  if b->>'type' in ('image','external_link','button') and ((b->>'url') !~* '^https?://[^/[:space:]@\\]+([/?#][^[:space:]\\]*)?$') then raise exception 'INVALID_URL';end if;
  if b->>'type'='text' and length(btrim(b->>'content'))=0 then raise exception 'EMPTY_TEXT';end if;
  insert into public.quiz_result_blocks(id,quiz_id,block_type,title,content,url,sort_order,visibility,scheduled_at,status)
  values((b->>'id')::uuid,qid,b->>'type',b->>'title',b->>'content',nullif(b->>'url',''),position,b->>'visibility',case when b->>'visibility'='scheduled_at' then (b->>'scheduled_at')::timestamptz else null end,'published');position:=position+1;
 end loop;
 update public.quiz_result_pages set revision=revision+1,show_percentage=(d->>'show_percentage')::boolean,show_correct_count=(d->>'show_correct_count')::boolean,show_wrong_count=(d->>'show_wrong_count')::boolean,show_duration=(d->>'show_duration')::boolean where quiz_id=qid returning revision into current_revision;
 return current_revision;
end;$$;
revoke all on function public.admin_result_document(uuid),public.admin_save_result(text) from public,anon;
grant execute on function public.admin_result_document(uuid),public.admin_save_result(text) to authenticated;

-- Extend only owned submitted results; the original runtime performs auth/ownership/grade checks.
alter function public.quiz_runtime(text,text) rename to quiz_runtime_v6;
revoke all on function public.quiz_runtime_v6(text,text) from public,anon,authenticated,service_role;
create function public.quiz_runtime(p_op text,p_payload text) returns text language plpgsql security definer set search_path='' as $$
declare r jsonb; p jsonb:=p_payload::jsonb; a public.attempts; q public.quizzes; settings public.quiz_result_pages; blocks jsonb; detail jsonb;
begin
 r:=public.quiz_runtime_v6(p_op,p_payload)::jsonb;
 if p_op<>'result' or r->>'status'<>'submitted' then return r::text;end if;
 select * into a from public.attempts where id=(r->>'id')::uuid;
 select * into q from public.quizzes where id=a.quiz_id;
 select * into settings from public.quiz_result_pages where quiz_id=q.id;
 if q.show_score and coalesce(settings.show_percentage,true) then r:=r||jsonb_build_object('percentage',case when a.max_score>0 then round(a.score*100/a.max_score,2) else null end);end if;
 if not coalesce(settings.show_correct_count,true) then r:=r||'{"correct_count":null}'::jsonb;end if;
 if not coalesce(settings.show_wrong_count,true) then r:=r||'{"wrong_count":null}'::jsonb;end if;
 if not coalesce(settings.show_duration,true) then r:=r||'{"duration_ms":null}'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'type',b.block_type,'title',coalesce(b.title,''),'content',coalesce(b.content,''),'url',coalesce(b.url,'')) order by b.sort_order,b.id),'[]') into blocks from public.quiz_result_blocks b
 where b.quiz_id=q.id and b.status='published' and (b.visibility='after_submit' or (b.visibility='after_quiz_closed' and (q.status='closed' or q.close_at<=clock_timestamp())) or (b.visibility='scheduled_at' and b.scheduled_at<=clock_timestamp()));
 r:=r||jsonb_build_object('blocks',blocks);
 -- Existing review gate requires show_correct_answers, owner submission AND quiz closure.
 if r ? 'review' then
  select coalesce(jsonb_agg(x||jsonb_build_object('answer',ans.answer_data->'value','is_correct',ans.is_correct,'points_awarded',case when q.show_score then ans.points_awarded else null end) order by ord),'[]') into detail
  from jsonb_array_elements(r->'review') with ordinality rr(x,ord) left join public.answers ans on ans.attempt_id=a.id and ans.question_id=(x->>'id')::uuid;
  r:=r||jsonb_build_object('review',detail);
 end if;
 return r::text;
end;$$;
revoke all on function public.quiz_runtime(text,text) from public,anon,authenticated;
grant execute on function public.quiz_runtime(text,text) to service_role;
commit;
