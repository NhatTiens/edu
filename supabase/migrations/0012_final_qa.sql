begin;
create function public.admin_dashboard() returns text language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 select jsonb_build_object(
 'courses',(select count(*) from public.courses where status<>'archived'),
 'quizzes',(select count(*) from public.quizzes),
 'attempts',(select count(*) from public.attempts),
 'today',(select count(*) from public.attempts where (started_at at time zone 'Asia/Ho_Chi_Minh')::date=(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date),
 'days',(select jsonb_agg(jsonb_build_object('date',d::date,'count',(select count(*) from public.attempts a where (a.started_at at time zone 'Asia/Ho_Chi_Minh')::date=d::date)) order by d) from generate_series((clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-6,(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date,interval '1 day') d),
 'recent',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select q.id,q.title,count(a.id) attempts,avg(a.score) filter(where a.status='submitted') average_score from (select id,title,updated_at from public.quizzes order by updated_at desc,id limit 5) q left join public.attempts a on a.quiz_id=q.id group by q.id,q.title,q.updated_at order by q.updated_at desc,q.id) t)
 ) into result;
 return result::text;
end;$$;
revoke all on function public.admin_dashboard() from public,anon;
grant execute on function public.admin_dashboard() to authenticated;
insert into public.site_settings(key,value,is_public,status) values('site.presentation',jsonb_build_object('name',coalesce((select value->>'name' from public.site_settings where key='site.brand'),'Học Online'),'logo','','facebook','https://facebook.com/','zalo','','title','Khóa học và kiểm tra online','description','','social_image',''),true,'published') on conflict do nothing;
create function public.admin_site_presentation(p_value text default null,p_revision timestamptz default null) returns text language plpgsql security definer set search_path='' as $$
declare current_row public.site_settings; v jsonb; k text;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED';end if;
 select * into current_row from public.site_settings where key='site.presentation' for update;
 if p_value is not null then
  if octet_length(p_value)>20000 then raise exception 'INVALID_SETTINGS';end if;
  v:=p_value::jsonb;
  if jsonb_typeof(v) is distinct from 'object' then raise exception 'INVALID_SETTINGS';end if;
  if p_revision is null or current_row.updated_at is distinct from p_revision then raise exception 'STALE_VERSION';end if;
  if exists(select 1 from jsonb_object_keys(v) as entry(key) where entry.key not in ('name','logo','facebook','zalo','title','description','social_image')) then raise exception 'INVALID_SETTINGS';end if;
  foreach k in array array['name','logo','facebook','zalo','title','description','social_image'] loop
   if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>2000 then raise exception 'INVALID_SETTINGS';end if;
  end loop;
  if length(btrim(v->>'name')) not between 1 and 100 or length(btrim(v->>'title')) not between 1 and 200 or length(v->>'description')>500 then raise exception 'INVALID_SETTINGS';end if;
  foreach k in array array['logo','facebook','zalo','social_image'] loop
   if v->>k<>'' and ((v->>k)!~ '^https?://[^/[:space:]@]+(/[^[:space:]]*)?$' or position(chr(92) in v->>k)>0) then raise exception 'INVALID_URL';end if;
  end loop;
  update public.site_settings set value=v,is_public=true,status='published' where key='site.presentation' returning * into current_row;
 end if;
 return jsonb_build_object('value',current_row.value,'revision',current_row.updated_at)::text;
end;$$;
revoke all on function public.admin_site_presentation(text,timestamptz) from public,anon;
grant execute on function public.admin_site_presentation(text,timestamptz) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('site-assets','site-assets',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy site_assets_read on storage.objects for select to anon,authenticated using(bucket_id='site-assets');
create policy site_assets_admin_insert on storage.objects for insert to authenticated with check(bucket_id='site-assets' and (select public.is_admin()));
create policy site_assets_admin_update on storage.objects for update to authenticated using(bucket_id='site-assets' and (select public.is_admin())) with check(bucket_id='site-assets' and (select public.is_admin()));
create policy site_assets_admin_delete on storage.objects for delete to authenticated using(bucket_id='site-assets' and (select public.is_admin()));
commit;
