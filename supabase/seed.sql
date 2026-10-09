-- Demo seed for a fresh Supabase project after migrations.
-- Auth users are provisioned by Supabase Auth; this file never contains a password or secret.
begin;

insert into public.course_sections (id, title, description, sort_order, is_published, status)
values
  ('10000000-0000-4000-8000-000000000001', 'Khóa học nổi bật', 'Nền tảng toán đại học và ôn thi.', 1, true, 'published'),
  ('10000000-0000-4000-8000-000000000002', 'Ôn thi giữa kỳ', 'Bài học ngắn, có ví dụ và bài tập.', 2, true, 'published')
on conflict (id) do update set title = excluded.title, description = excluded.description,
  sort_order = excluded.sort_order, is_published = excluded.is_published, status = excluded.status;

insert into public.courses (id, section_id, title, slug, description, category, price, old_price, badge, teacher_name, teacher_link, theme, sort_order, is_published)
values
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'Giải Tích 1', 'giai-tich-1', 'Giới hạn, đạo hàm và tích phân với ví dụ thực hành.', 'Giải tích', 99000, 199000, 'Cấp tốc', 'A.Vương', 'https://facebook.com/', 'orange', 1, true),
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', 'Đại Số Tuyến Tính', 'dai-so-tuyen-tinh', 'Vector, ma trận và hệ phương trình.', 'Đại số - Tổ hợp', 99000, 199000, 'Cấp tốc', 'A.Vương', 'https://facebook.com/', 'blue', 2, true),
  ('10000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000002', 'Xác Suất Thống Kê', 'xac-suat-thong-ke', 'Ôn tập xác suất và thống kê cơ bản.', 'Xác suất - Thống kê', 79000, 159000, 'Ôn thi', 'A.Vương', 'https://facebook.com/', 'green', 1, true)
on conflict (id) do update set section_id = excluded.section_id, title = excluded.title, slug = excluded.slug,
  description = excluded.description, category = excluded.category, price = excluded.price, old_price = excluded.old_price,
  badge = excluded.badge, teacher_name = excluded.teacher_name, teacher_link = excluded.teacher_link,
  theme = excluded.theme, sort_order = excluded.sort_order, is_published = excluded.is_published;

insert into public.banners (id, title, description, image_url, button_text, target_url, sort_order, is_published, status)
values ('10000000-0000-4000-8000-000000000201', 'Học chắc nền tảng', 'Bắt đầu quiz miễn phí trong 30 phút.', null, 'Làm bài ngay', '/q/giai-tich-1-chuong-1-2', 1, true, 'published')
on conflict (id) do update set title = excluded.title, description = excluded.description,
  button_text = excluded.button_text, target_url = excluded.target_url, sort_order = excluded.sort_order,
  is_published = excluded.is_published, status = excluded.status;

insert into public.quizzes (id, title, slug, description, duration_minutes, attempt_limit, status, show_score, show_ranking, show_correct_answers)
values ('20000000-0000-4000-8000-000000000001', 'Kiểm tra Giải Tích 1 Chương 1 và 2', 'giai-tich-1-chuong-1-2',
  'Bài kiểm tra kiến thức trọng tâm chương 1 và 2.', 30, 1, 'published', true, true, false)
on conflict (id) do update set title = excluded.title, slug = excluded.slug, description = excluded.description,
  duration_minutes = excluded.duration_minutes, attempt_limit = excluded.attempt_limit, status = excluded.status,
  show_score = excluded.show_score, show_ranking = excluded.show_ranking, show_correct_answers = excluded.show_correct_answers;

insert into public.quiz_fields (id, quiz_id, label, field_key, field_type, required, sort_order)
values
 ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'Họ và tên', 'name', 'text', true, 1),
 ('20000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000001', 'Email', 'email', 'email', false, 2)
on conflict (id) do update set label = excluded.label, field_key = excluded.field_key, field_type = excluded.field_type,
  required = excluded.required, sort_order = excluded.sort_order;

insert into public.questions (id, quiz_id, question_type, content, points, sort_order)
values
 ('20000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000001', 'multiple_choice', 'Hàm số f(x) = x² + 2x + 1 liên tục trên R?', 1, 1),
 ('20000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000001', 'true_false', 'Mọi đa thức đều liên tục trên R.', 1, 2),
 ('20000000-0000-4000-8000-000000000203', '20000000-0000-4000-8000-000000000001', 'short_answer', 'Đạo hàm của x² tại x = 2 bằng bao nhiêu?', 1, 3)
on conflict (id) do update set content = excluded.content, points = excluded.points, sort_order = excluded.sort_order;

insert into public.question_options (id, question_id, content, is_correct, sort_order)
values
 ('20000000-0000-4000-8000-000000000301', '20000000-0000-4000-8000-000000000201', 'Đúng với mọi x ∈ R', true, 1),
 ('20000000-0000-4000-8000-000000000302', '20000000-0000-4000-8000-000000000201', 'Chỉ đúng tại x = 0', false, 2),
 ('20000000-0000-4000-8000-000000000303', '20000000-0000-4000-8000-000000000201', 'Chỉ đúng với x > 0', false, 3),
 ('20000000-0000-4000-8000-000000000304', '20000000-0000-4000-8000-000000000201', 'Sai', false, 4),
 ('20000000-0000-4000-8000-000000000305', '20000000-0000-4000-8000-000000000202', 'Đúng', true, 1),
 ('20000000-0000-4000-8000-000000000306', '20000000-0000-4000-8000-000000000202', 'Sai', false, 2)
on conflict (id) do update set content = excluded.content, is_correct = excluded.is_correct, sort_order = excluded.sort_order;

insert into public.short_answer_accepted_answers (id, question_id, answer, answer_normalized, sort_order)
values
 ('20000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000203', '4', '4', 1),
 ('20000000-0000-4000-8000-000000000402', '20000000-0000-4000-8000-000000000203', '4.0', '4.0', 2)
on conflict (id) do update set answer = excluded.answer, answer_normalized = excluded.answer_normalized, sort_order = excluded.sort_order;

insert into public.quiz_result_blocks (id, quiz_id, block_type, title, content, sort_order, visibility_rule)
values ('20000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000001', 'text', 'Bạn đã hoàn thành!', 'Xem lại kiến thức chương 1 và 2 để củng cố kết quả.', 1, '{"after":"submit"}'::jsonb)
on conflict (id) do update set title = excluded.title, content = excluded.content, sort_order = excluded.sort_order, visibility_rule = excluded.visibility_rule;

insert into public.site_settings (key, value, is_public, status)
values
 ('site.brand', '{"name":"Học Online","tagline":"Khóa học và kiểm tra online"}'::jsonb, true, 'published'),
 ('site.social', '{"facebook":"https://facebook.com/"}'::jsonb, true, 'published')
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public, status = excluded.status;

-- To provision an admin after creating an Auth user, run as a trusted SQL editor:
-- insert into public.profiles (id, display_name) values ('AUTH-USER-UUID', 'Admin') on conflict do nothing;
-- insert into public.admins (user_id) values ('AUTH-USER-UUID') on conflict do nothing;

commit;

-- Builder fixture: one quiz, all eight participant types, all three question types.
begin;
update public.quiz_fields set is_identifier=(field_key='name'), show_on_leaderboard=(field_key='name')
where quiz_id='20000000-0000-4000-8000-000000000001';
insert into public.quiz_fields(id,quiz_id,label,field_key,field_type,placeholder,required,options,sort_order)
values
('20000000-0000-4000-8000-000000000103','20000000-0000-4000-8000-000000000001','Tuổi','age','number','18',false,'[]',3),
('20000000-0000-4000-8000-000000000104','20000000-0000-4000-8000-000000000001','Website','website','url','https://...',false,'[]',4),
('20000000-0000-4000-8000-000000000105','20000000-0000-4000-8000-000000000001','Lớp','class','select','',false,'["K26","K27"]',5),
('20000000-0000-4000-8000-000000000106','20000000-0000-4000-8000-000000000001','Ca học','session','radio','',false,'["Sáng","Chiều"]',6),
('20000000-0000-4000-8000-000000000107','20000000-0000-4000-8000-000000000001','Chủ đề','topics','checkbox','',false,'["Đạo hàm","Tích phân"]',7),
('20000000-0000-4000-8000-000000000108','20000000-0000-4000-8000-000000000001','Ghi chú','notes','textarea','Thông tin thêm',false,'[]',8)
on conflict(id) do update set label=excluded.label,field_type=excluded.field_type,options=excluded.options,sort_order=excluded.sort_order;
update public.questions set case_insensitive=true where quiz_id='20000000-0000-4000-8000-000000000001';
commit;
