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

