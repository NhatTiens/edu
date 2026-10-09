begin;
-- Tighten the builder RPC independently of UI validation, before destructive replacement.
alter function public.admin_save_quiz(text,text,boolean) rename to admin_save_quiz_v5;
revoke all on function public.admin_save_quiz_v5(text,text,boolean) from public,anon,authenticated,service_role;
create function public.admin_save_quiz(p_document text,p_password_hash text default null,p_remove_password boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare d jsonb; f jsonb; x jsonb; k text;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 if p_document is null or octet_length(p_document)>1000000 then raise exception 'INVALID_QUIZ';end if;
 d:=p_document::jsonb;
 if jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'fields') is distinct from 'array' or jsonb_typeof(d->'questions') is distinct from 'array' then raise exception 'INVALID_CHILDREN';end if;
 foreach k in array array['title','slug','description','open_at','close_at','status'] loop
  if jsonb_typeof(d->k) is distinct from 'string' then raise exception 'INVALID_QUIZ';end if;
 end loop;
 foreach k in array array['show_score','show_rank','show_correct_answers'] loop
  if jsonb_typeof(d->k) is distinct from 'boolean' then raise exception 'INVALID_QUIZ';end if;
 end loop;
 for f in select value from jsonb_array_elements(d->'fields') loop
  if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'options') is distinct from 'array' then raise exception 'INVALID_FIELD';end if;
  if f->>'key' in ('constructor','prototype','__proto__') then raise exception 'INVALID_FIELD';end if;
  foreach k in array array['id','label','key','type','placeholder'] loop
   if jsonb_typeof(f->k) is distinct from 'string' then raise exception 'INVALID_FIELD';end if;
  end loop;
  foreach k in array array['required','is_identifier','show_on_leaderboard'] loop
   if jsonb_typeof(f->k) is distinct from 'boolean' then raise exception 'INVALID_FIELD';end if;
  end loop;
 end loop;
 for x in select value from jsonb_array_elements(d->'questions') loop
  if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'options') is distinct from 'array' or jsonb_typeof(x->'accepted_answers') is distinct from 'array' or jsonb_typeof(x->'points') is distinct from 'number' then raise exception 'INVALID_QUESTION';end if;
  if x->>'type' not in ('multiple_choice','true_false','short_answer') or x->>'type' is null then raise exception 'INVALID_QUESTION';end if;
  foreach k in array array['id','content','correct_option_id'] loop
   if jsonb_typeof(x->k) is distinct from 'string' then raise exception 'INVALID_QUESTION';end if;
  end loop;
  foreach k in array array['correct_boolean','case_insensitive'] loop
   if jsonb_typeof(x->k) is distinct from 'boolean' then raise exception 'INVALID_QUESTION';end if;
  end loop;
 end loop;
 return public.admin_save_quiz_v5(p_document,p_password_hash,p_remove_password);
end;$$;
revoke all on function public.admin_save_quiz(text,text,boolean) from public,anon;
grant execute on function public.admin_save_quiz(text,text,boolean) to authenticated;

-- Explicitly restate the private data grants; never rely on permissive default ACLs.
revoke all on public.attempts,public.answers,public.questions,public.question_options,public.short_answer_accepted_answers,public.quiz_fields,public.quiz_result_blocks,public.quiz_result_pages,public.quiz_access_sessions,public.quiz_rate_limits from public,anon,authenticated;
revoke all on public.published_quizzes,public.published_quiz_fields,public.published_quiz_questions,public.published_question_options from public,anon,authenticated;
revoke insert,update,delete on public.admins,public.profiles,public.admin_users from public,anon,authenticated;
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id in ('homepage-banners','course-thumbnails');
commit;
