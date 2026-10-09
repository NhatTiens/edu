begin;

-- PostgREST RPC callers must meet the same contract as the server action.
-- Validate before entering the existing transactional writer: missing revision
-- must not bypass optimistic locking; missing blocks must not delete content.
alter function public.admin_save_result(text) rename to admin_save_result_v7;
revoke all on function public.admin_save_result_v7(text) from public, anon, authenticated, service_role;

create function public.admin_save_result(p_document text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
  b jsonb;
  field text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_document is null or octet_length(p_document) > 1000000 then
    raise exception 'INVALID_DOCUMENT';
  end if;
  d := p_document::jsonb;
  if jsonb_typeof(d) is distinct from 'object'
     or jsonb_typeof(d->'quiz_id') is distinct from 'string'
     or jsonb_typeof(d->'revision') is distinct from 'number'
     or (d->>'revision') !~ '^(0|[1-9][0-9]*)$'
     or jsonb_typeof(d->'blocks') is distinct from 'array' then
    raise exception 'INVALID_DOCUMENT';
  end if;
  if jsonb_array_length(d->'blocks') > 100 then raise exception 'INVALID_BLOCKS'; end if;
  foreach field in array array['show_percentage','show_correct_count','show_wrong_count','show_duration'] loop
    if jsonb_typeof(d->field) is distinct from 'boolean' then raise exception 'INVALID_SETTINGS'; end if;
  end loop;
  for b in select value from jsonb_array_elements(d->'blocks') loop
    if jsonb_typeof(b) is distinct from 'object' then raise exception 'INVALID_BLOCK'; end if;
    foreach field in array array['id','type','title','content','url','visibility','scheduled_at'] loop
      if jsonb_typeof(b->field) is distinct from 'string' then raise exception 'INVALID_BLOCK'; end if;
    end loop;
    if length(b->>'title') > 200 or length(b->>'content') > 10000 or length(b->>'url') > 2000 then
      raise exception 'INVALID_BLOCK';
    end if;
    if b->>'visibility' not in ('after_submit','after_quiz_closed','scheduled_at') then
      raise exception 'INVALID_VISIBILITY';
    end if;
    if b->>'visibility' = 'scheduled_at' and (
      (b->>'scheduled_at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$'
    ) then raise exception 'INVALID_SCHEDULE'; end if;
  end loop;
  if (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(d->'blocks')) <> jsonb_array_length(d->'blocks') then
    raise exception 'DUPLICATE_BLOCK';
  end if;
  return public.admin_save_result_v7(p_document);
end;
$$;
revoke all on function public.admin_save_result(text) from public, anon;
grant execute on function public.admin_save_result(text) to authenticated;

commit;
