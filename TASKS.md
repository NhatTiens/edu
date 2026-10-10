# EduQuiz — trạng thái công việc

Cập nhật 10/10/2026 (Asia/Ho_Chi_Minh), từ upstream `d4ccb04`. Checklist này thay các ghi chú scaffold cũ; lịch sử triển khai còn trong Git.

## Đã triển khai và kiểm thử local

- [x] Supabase schema/migrations, RLS, active-admin authorization ở server và SQL, fail-closed khi thiếu cấu hình.
- [x] CMS banner/section/course, upload ảnh, homepage/search và liên kết giảng viên.
- [x] Quiz Builder, 8 loại participant field, 3 loại câu hỏi, password hash, lịch và publish.
- [x] Runtime unlock/start/autosave/reload/timer/grading/submit/idempotency/attempt limit; snapshot và timestamp do server quản lý.
- [x] Result Builder, YouTube an toàn, ranking, public-field allowlist, participants/detail/CSV/analytics.
- [x] Security audit và follow-up 0010/0011: IDOR, grants/RLS, session, brute-force/rate limit, URL/XSS/upload, correct-answer/secret leakage regression.
- [x] Final QA fixes: dashboard dữ liệu thật; lưu cài đặt branding/SEO/upload; login giữ email sau lỗi; accessible select labels, focus, bảng cuộn bằng bàn phím; error/loading states.
- [x] Thêm migration 0012 và tests cho dashboard/settings, authorization/revision/rollback.
- [x] Thêm full lifecycle E2E với production Next app và PostgreSQL WASM, đúng các viewport 375×812, 768×1024, 1440×900.

Kết quả chạy cuối và giới hạn bằng chứng được ghi trong `IMPLEMENTATION_STATUS.md`. Không xóa tính năng hay tắt kiểm tra để test pass.

## Trước khi release trên môi trường thật

- [ ] Backup database hiện hữu; áp dụng các migrations còn thiếu đến 0012 (không chạy cả schema.sql và migrations).
- [ ] Cấu hình Supabase URL/publishable key/service key, QUIZ_SESSION_SECRET ổn định và NEXT_PUBLIC_SITE_URL HTTPS chính xác.
- [ ] Xác minh Auth login/logout/refresh/expiry, PostgREST RLS và Storage trên project thật; credential chưa có trong workspace.
- [ ] Chạy multi-connection PostgreSQL contention: start cùng identity, submit trùng và save/submit cạnh tranh.
- [ ] Production smoke, domain/HTTPS, backup/restore/rollback, giám sát lỗi và retention cho ảnh/session/participant.
- [ ] Kiểm tra tích hợp Facebook/YouTube thật trên domain deploy; E2E local dùng external fixtures.
- [ ] Theo dõi dev-only braces advisory ghi trong SECURITY.md; không tự hạ dependency cross-major để che cảnh báo.

## Giới hạn sản phẩm có chủ đích

Identifier là dữ liệu người tham gia tự khai; giới hạn theo người thật cần Auth/OTP. Không có identifier thì giới hạn theo cookie trình duyệt. Attempt hết hạn được finalize ở request tiếp theo; chưa có background sweeper. Ảnh cũ được giữ để tránh phá URL; chưa có retention job. Các admin hiện có quyền toàn site, không phải multi-tenant. Reset password/self-service registration chưa được triển khai; tài khoản admin được provision qua Supabase.
