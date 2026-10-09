begin;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
select exists(select 1 from public.admins a join public.profiles p on p.id=a.user_id
where a.user_id=(select auth.uid()) and a.status='active' and p.status='active');
$$;
grant select, insert, update, delete on public.courses, public.course_sections, public.banners to authenticated;
drop policy if exists published_read on public.courses;
drop policy if exists published_read on public.course_sections;
drop policy if exists published_read on public.banners;
drop policy public_published_read on public.courses;
create policy public_published_read on public.courses for select to anon, authenticated using
(status='published' and is_published and (section_id is null or exists
(select 1 from public.course_sections s where s.id=section_id and s.status='published' and s.is_published)));

alter table public.courses add column if not exists course_link text;
alter table public.courses add constraint courses_course_link_valid check (course_link is null or course_link ~* '^(https?://|/)');

-- Storage buckets are private by default. Public homepage assets use immutable public URLs;
-- writes remain admin-only through Storage RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('homepage-banners', 'homepage-banners', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
  ('course-thumbnails', 'course-thumbnails', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists homepage_assets_read on storage.objects;
create policy homepage_assets_read on storage.objects for select to anon, authenticated
using (bucket_id in ('homepage-banners','course-thumbnails'));
drop policy if exists homepage_assets_admin_insert on storage.objects;
create policy homepage_assets_admin_insert on storage.objects for insert to authenticated
with check (bucket_id in ('homepage-banners','course-thumbnails') and (select public.is_admin()));
drop policy if exists homepage_assets_admin_update on storage.objects;
create policy homepage_assets_admin_update on storage.objects for update to authenticated
using (bucket_id in ('homepage-banners','course-thumbnails') and (select public.is_admin()))
with check (bucket_id in ('homepage-banners','course-thumbnails') and (select public.is_admin()));
drop policy if exists homepage_assets_admin_delete on storage.objects;
create policy homepage_assets_admin_delete on storage.objects for delete to authenticated
using (bucket_id in ('homepage-banners','course-thumbnails') and (select public.is_admin()));

commit;
