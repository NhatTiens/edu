# Checklist hoàn thiện EduQuiz

Cập nhật: 09/10/2026, múi giờ Việt Nam. Giữ visual của frontend hiện tại; không xóa chức năng để vượt kiểm tra. Checkbox chỉ đánh dấu việc đã triển khai và kiểm tra trong lượt này. Các màn hình quản lý và luồng quiz còn là scaffold, không phải sản phẩm đã hoàn thiện.

## P0 · Nền tảng đã triển khai

- [x] Đọc toàn bộ README, handoff, product spec, project map, package, schema, app, components, lib và data. Source nằm ở root, không phải src.
- [x] Cài npm dependencies; tạo package-lock.json và .gitignore.
- [x] Sửa lỗi Supabase SSR cookie typing và nâng @supabase/ssr cho tương thích supabase-js hiện được resolve.
- [x] Thay next lint bằng ESLint CLI, thêm typecheck, test, verify và test:smoke.
- [x] Build production thành công, không tắt TypeScript hoặc quy tắc lint.
- [x] Tách APP_DATA_MODE=demo khỏi chế độ Supabase. Hiện nhãn demo và không tự fallback dữ liệu giả khi dịch vụ thật lỗi.
- [x] Đăng nhập bằng Supabase Auth, proxy refresh cookie, kiểm tra admins (có fallback admin_users khi nâng cấp) trong server guard; không dùng user_metadata để cấp quyền.
- [x] Repository catalog đọc khóa học/nhóm đã xuất bản, mapping typed, tìm kiếm tiếng Việt không dấu, kiểm tra URL giảng viên.
- [x] Giữ CSS gốc; nối form tìm kiếm, giá trên card và loại bỏ ID section trùng.
- [x] Migration RLS cho tất cả bảng, admin membership, constraints, FK câu trả lời cùng quiz, ranking index, updated_at trigger.
- [x] Unit tests scoring/ranking/catalog và PostgreSQL WASM tests cho migration/RLS.
- [x] Smoke test HTTP 27 trang demo, tìm kiếm, admin redirect và quiz fail-closed trong chế độ thật chưa cấu hình.
- [x] Thêm migration 0003 production foundation: profiles/admins, accepted answers, site settings, lifecycle timestamps/status, safe public quiz views và index/constraint bổ sung.
- [x] Thêm repository quiz/site-settings; public quiz chỉ nhận DTO allowlist không có correct answer/accepted answer.
- [x] Hoàn thiện middleware kiểm tra admin membership, logout server action và redirect login đúng trạng thái.
- [x] Thêm `supabase/seed.sql` cho homepage, catalog, banner và quiz demo hoàn chỉnh; kiểm tra migration + seed bằng PostgreSQL WASM.

## P1 · Provision Supabase thật; phụ thuộc P0

- [ ] Tạo/chọn Supabase project và cấu hình URL cùng anon/publishable-compatible key; không commit secret.
- [ ] Backup nếu có DB cũ, kiểm tra dữ liệu cũ đáp ứng constraint trước khi chạy migration; không chạy cả schema.sql và migrations.
- [ ] Áp dụng migration 0001 rồi 0002 trên database mới; DB đã có schema gốc chỉ chạy 0002 sau review.
- [ ] Tạo tài khoản Auth admin và thêm UUID vào profiles/admins bằng SQL đáng tin cậy.
- [ ] Sinh lại full Database types từ project thật, thay typed subset đọc catalog/auth.
- [ ] Kiểm thử đăng nhập thành công/thất bại, logout, tài khoản không phải admin, session hết hạn/refresh, cookie thực và RLS qua PostgREST.
- [ ] Nạp catalog/banners thực, chuyển APP_DATA_MODE=supabase và xác nhận không còn nội dung mẫu trên các module đã nối.

## P2 · CRUD quản trị; phụ thuộc P1

- [x] Chuẩn hóa CMS validation/server actions, optimistic concurrency, loading/empty/error states, toast và confirm archive.
- [ ] Bổ sung logout, reset password theo Supabase Auth; kiểm tra rate limit đăng nhập.
- [x] CRUD course sections/courses/banners; trạng thái draft/published, slug duy nhất, thứ tự, optimistic concurrency.
- [x] Nối banner, category, thumbnail và course link vào homepage/search từ Supabase thật.
- [x] Thiết lập Storage bucket/policy cho banner/thumbnail, giới hạn MIME/kích thước, preview và dọn file upload lỗi.
- [x] CRUD quizzes/fields/questions/options/accepted answers trong transaction; builder dùng UUID thật.
- [x] Result Block Builder nối RPC Supabase, lưu nguyên tử và kiểm tra revision; xem kết quả P4 bên dưới.
- [x] Bổ sung schema cho branding/site settings, participant identity digest/session fields, accepted answers và cấu hình quiz result; leaderboard display field còn phụ thuộc product decision.
- [x] Hoàn thiện builder ba dạng câu hỏi, điểm, thứ tự, thêm/xóa/lưu/preview; không đưa đáp án vào DTO public.
- [ ] Chốt version/snapshot đề khi publish và khi bắt đầu làm, để sửa đề không đổi điểm của attempt đang chạy.

## P3 · Quiz transaction backend; phụ thuộc P2

- [x] Hash mật khẩu quiz, kiểm tra lịch mở/đóng, unlock token opaque HttpOnly (DB lưu hash), signed visitor cookie; rate limit dùng kho dùng chung.
- [x] Validate form theo quiz_fields, chuẩn hóa field định danh; không dùng IP làm khóa định danh chính.
- [x] Migration participant identity digest, attempt session/token hash, expires_at, question snapshot, indexes và điều kiện trạng thái.
- [x] RPC start: khóa theo quiz/identity và kiểm tra attempt_limit trong cùng transaction, dùng server started_at.
- [x] Public question DTO chỉ gồm id/type/content/options/points; không trả password_hash, is_correct hoặc accepted answers.
- [x] API lưu nháp có session ownership, giới hạn payload và question membership; phục hồi sau refresh.
- [x] RPC submit: lock attempt, tính điểm server từ snapshot, kiểm tra hạn, ghi answers + điểm + submitted_at + duration_ms một transaction.
- [x] Idempotency cho retry/submit đồng thời, không chấm hai lần, không tin timestamp/score do client gửi.
- [ ] Kiểm thử concurrency với PostgreSQL thật, sai token, sai slug, attempt của người khác, request quá hạn và duplicate submit.

## P4 · Nối frontend quiz; phụ thuộc P3

- [x] Gỡ trạng thái chưa sẵn sàng trong real-mode layout sau kiểm thử P3 local; public quiz không dùng mock.
- [x] Nối unlock/form/instructions với API; route slug và attemptId phải được xác minh.
- [x] Thay câu hỏi cố định bằng DTO, navigator thật, lưu đáp án, review flags và xác nhận nộp.
- [x] Timer lấy mốc server, tự submit, resume, retry mạng và xử lý hết giờ ở server.
- [x] Result/leaderboard từ DB: score DESC, duration_ms ASC, submitted_at ASC; tie-break cuối ổn định.
- [x] Tuân thủ show_score/show_ranking/show_correct_answers; mặc định không công khai thông tin Facebook/email/identity.
- [x] Result blocks text/YouTube/link/button/image, visibility after_submit/after_quiz_closed/scheduled_at và allowlist URL.

## P5 · Analytics và release; phụ thuộc P4

- [ ] Số liệu dashboard, participants, correctness/question, completion rate và duration lấy từ DB; phân trang/filter/export CSV an toàn.
- [ ] Bổ sung seed fixtures/test environments, kiểm thử full lifecycle admin → publish → quiz → kết quả.
- [x] Visual QA CMS/homepage 375px, 768px, 1440px bằng Chromium; không còn overflow ngang ở các route kiểm tra.
- [ ] Sửa overflow/keyboard navigation/focus/error messages dựa trên QA, không redesign.
- [ ] Rà soát security headers, CSP cho YouTube/Storage, rate limit, secrets, data retention, backup/restore và log không chứa PII.
- [ ] CI chạy npm ci + typecheck + lint + test + build + test:smoke; Supabase integration suite riêng.
- [ ] Deploy theo handoff (Vercel), cấu hình domain/HTTPS/environment, production smoke và rollback runbook.

Điểm bắt đầu lượt kế tiếp: P1 nếu có credential. Khi chưa có credential, có thể tiếp tục request validation, DTO và transaction contract/test ở P2/P3, nhưng không tự nhận đã chạy integration với Supabase thật.


## Homepage CMS — kết quả lượt 09/10/2026

- [x] Homepage/search/CMS dùng repository Supabase; không fallback mock.
- [x] CMS server actions kiểm tra quyền, dữ liệu, slug unique, stale updated_at; form có preview, toast, archive confirm và restore.
- [x] Migration 0004 sửa grants/policy cũ, thêm course_link, Storage buckets/policies; public không thấy archived hoặc khóa thuộc nhóm ẩn.
- [x] Chromium local HTTP fixture: homepage/list/form ở 375/768/1440 không tràn ngang; screenshots lưu artifacts/cms-qa.
- [ ] Áp dụng 0004 và kiểm thử Auth/PostgREST/Storage trên Supabase project thật; workspace chỉ có .env.example, chưa có credential.
- [ ] Retention job xóa ảnh cũ không còn tham chiếu (hiện giữ ảnh cũ để tránh phá URL).

Checkbox P2 phía trên chỉ hoàn thành trong phạm vi Homepage CMS; reset password, quiz CRUD, analytics và branding/SEO vẫn giữ scope cũ chưa hoàn tất.

CMS verification: npm run verify (typecheck/lint/10 tests/production build) PASS; test:smoke PASS (20 legacy routes); test:cms-browser PASS với fixture local cho CRUD/archive/restore/order và responsive. Supabase live Auth/PostgREST/Storage chưa xác minh vì chưa có cấu hình project. Ảnh chụp local không đại diện dữ liệu production.


## Quiz Builder — kết quả lượt tiếp tục 09/10/2026

- [x] Metadata: title/slug/description/password/duration/open/close/attempt limit/status và show_score/show_rank/show_correct_answers; password scrypt server-only.
- [x] Form Builder 8 loại field, options, required, identifier, leaderboard flag, reorder/delete/preview; validate cấu hình client + server và participant preview.
- [x] Question Builder MC một correct option, boolean đúng/sai, short answer nhiều accepted answers, trim và case sensitivity; create/edit/delete/reorder/points/preview.
- [x] Migration 0005, admin document DTO không chứa password hash, admin-only save RPC atomic + optimistic concurrency, public DTO không chứa đáp án.
- [x] Seed đủ 8 loại field + 3 dạng câu hỏi; cập nhật schema.sql cùng migration chain.
- [x] Unit/PGlite tests: auth/RLS, rollback, stale version, case normalization, password, seed, bảo toàn attempt history. Chromium kiểm tra luồng builder với PostgreSQL WASM, ảnh 375/768/1440.
- [ ] Supabase live: áp dụng 0005, seed trên môi trường demo/staging, kiểm tra Auth/PostgREST với credential thật (workspace chưa có).
- [x] Attempt snapshot, unlock/start/submit, participant validation/attempt limit và result rendering hoàn tất trong runtime 0006. Builder vẫn khóa sửa nội dung quiz có attempts.

Kiểm thử lượt này: typecheck, lint, tests liên quan và production build đã pass. Analytics vẫn là scaffold; Result Block Builder đã được tiếp tục trong lượt P4 bên dưới.


## Public quiz runtime — kết quả 09/10/2026

- [x] Migration 0006: service-only RPC, session token hash, distributed rate limit, private immutable snapshot, atomic start/save/submit/result/leaderboard.
- [x] Tất cả public quiz routes nối runtime thật; xử lý missing/draft/scheduled/closed/password/no-password; không đưa password vào URL.
- [x] Cookie HttpOnly/Strict (+Secure khi HTTPS), Origin check, bounded strict JSON, owner+slug checks; public views cũ đã bị thu hồi quyền.
- [x] Server clock, deadline, autosave/resume, grade ba dạng, idempotency; late payload không đổi đáp án đã lưu.
- [x] Ranking và visibility flags; answer review chỉ sau owner submit + quiz closure; leaderboard chỉ có tên được admin chọn hiển thị.
- [x] Quiz seed chạy browser E2E start→result 3/3→leaderboard. Test thêm mật khẩu, rate limit, CSRF, quota, reload, duplicate/late submit, HTML/RSC/API/bundle leakage marker.
- [ ] Apply migration 0006 + cấu hình service key/QUIZ_SESSION_SECRET trên Supabase live; kiểm thử multi-connection PostgreSQL concurrency và PostgREST deployment thật.
- [ ] Analytics chưa thuộc lượt này; Result Blocks CMS/rendering xem kết quả P4 bên dưới. Builder vẫn khóa sửa nội dung quiz có attempts dù runtime đã có snapshot, để bảo toàn FK/history.

Giới hạn identity: khi không cấu hình identifier, attempt_limit theo signed browser cookie (có thể thay cookie/thiết bị). Identifier hiện do người dùng khai báo; xác thực người thật cần Auth/OTP. Hết hạn tự finalize khi có request tiếp theo; chưa có background sweeper. Xem README runtime để vận hành.

Kiểm chứng public runtime: typecheck/lint/build pass; unit/database suite 18 tests; seed E2E browser + PostgreSQL WASM đạt 3/3 và leaderboard. Không có credential Supabase live trong workspace.


## Result Page Builder — tiếp tục 09/10/2026

- [x] Review implementation 0007 hiện có; giữ repository/RPC thật, không fallback mock.
- [x] Admin thêm/sửa/xóa/reorder năm loại block; lịch theo giờ máy, persist UTC, preview, unsaved indicator, lỗi validation và optimistic revision.
- [x] Ba dạng YouTube URL chuẩn hóa thành youtube-nocookie embed; external URL chỉ http/https, không credentials/backslash; text render qua React, không HTML tùy ý.
- [x] Server lọc visibility bằng clock của DB; chỉ session sở hữu attempt đã submit nhận blocks. Answer details cần Admin cho phép và quiz đã đóng.
- [x] Score/rank/answer details theo cấu hình quiz; percentage/correct/wrong/duration có công tắc riêng. Tắt show_score ẩn các chỉ số điểm liên quan.
- [x] Migration 0008 chặn payload thiếu/null/wrong type, revision thiếu, lịch không xác định, giới hạn nội dung và ID trùng trước transaction ghi; không cho gọi RPC cũ để bỏ qua validation.
- [x] Đồng bộ schema.sql với 0007 + 0008; kiểm thử cài mới, quyền RPC/RLS, rollback payload lỗi, không thay đổi attempt/answers/revision quiz sau sửa video, quyền xem và lịch.
- [ ] Áp dụng 0007 + 0008 trên Supabase live và kiểm thử Auth/PostgREST với thông tin kết nối thật; workspace chưa có credential.

Kiểm chứng lượt Result Builder: `npm run verify` PASS (typecheck, lint, 21 tests và production build). `npm run test:result-builder` PASS với Chromium Headless Shell và PostgreSQL WASM HTTP fixture; admin/result ở 375/768/1440 không overflow ngang. Ảnh chụp hiện tại nằm trong `artifacts/result-builder/`. Đây không phải kiểm thử Supabase live.
