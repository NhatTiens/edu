# EduQuiz Platform

Ứng dụng Next.js App Router + TypeScript + Supabase cho khóa học và kiểm tra trực tuyến. Frontend gốc được giữ làm chuẩn visual. Đây là bản đang triển khai, chưa phải release production.

## Chạy local

Node.js 22 trở lên, npm. Dependency đã khóa trong package-lock.json.

```bash
npm install
cp .env.example .env.local
npm run dev
```

PowerShell dùng `Copy-Item .env.example .env.local`. Mở http://localhost:3000. File mẫu đặt APP_DATA_MODE=supabase. Cấu hình project và migration trước khi mở Homepage CMS. Demo mode chỉ còn cho các scaffold quiz cũ.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
```

`npm run verify` chạy typecheck, lint, unit/database tests rồi build. `test:smoke` cần build trước và tự mở/đóng hai server local. CI có thể dùng npm ci thay npm install.

## Kết nối Supabase thật

Cấu hình `.env.local` theo mẫu sau. URL và anon key là cấu hình public của Supabase; không dùng service-role key thay anon key.

```dotenv
APP_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
# Legacy projects may use NEXT_PUBLIC_SUPABASE_ANON_KEY instead.
SUPABASE_SERVICE_ROLE_KEY=SERVER_ONLY_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Với database mới, chạy `supabase/migrations/0001_initial.sql`, `0002_security_foundation.sql`, rồi `0003_production_foundation.sql` theo thứ tự. `supabase/schema.sql` là bản tổng hợp tương đương dành cho cài mới; chỉ chọn một cách. Nếu đã áp dụng schema gốc, backup và review dữ liệu trước khi chạy riêng 0002 rồi 0003. Migration sẽ rollback nếu dữ liệu cũ vi phạm constraint, không tự xóa dữ liệu để vượt lỗi. `supabase/seed.sql` nạp catalog, banner và quiz demo sau khi migration hoàn tất.

Tạo tài khoản trong Supabase Auth rồi cấp quyền bằng SQL Editor đáng tin cậy, thay UUID bằng id thực của tài khoản. Membership không được phép ghi từ frontend, API public hay user_metadata.

```sql
insert into public.profiles(id, display_name)
values ('REPLACE_WITH_AUTH_USER_UUID', 'Admin')
on conflict (id) do nothing;
insert into public.admins(user_id)
values ('REPLACE_WITH_AUTH_USER_UUID')
on conflict (user_id) do nothing;
```

Đăng nhập tại `/admin/login`. Proxy refresh session và kiểm tra membership `admins`; server layout kiểm tra lại `getAdmin()`. Từ migration 0004, quyền được xác nhận bằng RPC is_admin với cả admins và profiles active. Các action/API admin bổ sung sau này bắt buộc kiểm tra `getAdmin()` riêng và từ chối khi kết quả null; không dùng demo-page guard để cấp quyền ghi.

Chế độ thật đã nối homepage, banners, catalog, nhóm khóa học, search và CRUD CMS có upload. Public quiz đã nối unlock/start/submit/result/leaderboard qua runtime 0006; analytics và Result Blocks CMS còn lại. Runtime thiếu cấu hình trả lỗi và không dùng dữ liệu giả. Dữ liệu demo không được dùng làm fallback khi Supabase lỗi. Thiếu cấu hình sẽ chặn admin và hiện lỗi tải catalog.

`SUPABASE_SERVICE_ROLE_KEY` chỉ được dùng trong module server-only cho các transaction quiz tin cậy; không đưa biến này vào NEXT_PUBLIC, client bundle hoặc source control. Chưa có credential hoặc migration nào được áp dụng lên dịch vụ bên ngoài trong lượt tiếp quản này.

## Cấu trúc

`app/` chứa routes, `components/` chứa visual hiện tại, `lib/repositories/` là lớp đọc catalog/quiz/settings, `lib/catalog.ts` map DTO, `lib/auth/admin.ts` kiểm tra quyền, `lib/supabase/` chứa browser/server/service clients và typed subset. `proxy.ts` xử lý cookie trước admin request. `data/mock.ts` giữ fixtures gốc. Source không có thư mục src.

Database types hiện bao phủ catalog, safe quiz views, settings và admin membership. Sau khi provision, sinh full types từ database thật trước khi mở rộng CRUD. Các bảng câu hỏi, đáp án, attempts chỉ admin/service role được truy cập trực tiếp; public quiz phải đi qua repository/service trả DTO an toàn.

Xem `AUDIT_REPORT.md` cho phát hiện và bằng chứng kiểm tra, `TASKS.md` cho thứ tự dependency, `WORK_HANDOFF.md` và `docs_PRODUCT_SPEC.md` cho yêu cầu sản phẩm gốc.

## Homepage CMS (09/10/2026)

Chạy migration `0004_homepage_cms.sql` sau 0001–0003 trong Supabase SQL Editor hoặc migration runner. Migration tạo hai bucket public `homepage-banners`, `course-thumbnails` (5 MB); chỉ admin active được upload/update/delete. Không cần service-role key cho CMS. Tắt public signups trong Supabase Auth nếu site chỉ dùng tài khoản admin được cấp trước.

Đặt `APP_DATA_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL` và publishable/anon key trong `.env.local`. Homepage/search và CMS không dùng mock; thiếu kết nối hiển thị error state. Tạo Auth user rồi cấp `profiles` + `admins` theo SQL phía trên. Membership `admins`/`profiles` active là nguồn quyền duy nhất sau 0004; legacy `admin_users` không cấp quyền nữa.

Admin tại `/admin/banners`, `/admin/course-sections`, `/admin/courses`: thêm, sửa, ẩn/hiện, lưu trữ/khôi phục; sửa trường Thứ tự để sắp xếp (số nhỏ trước, UUID giải quyết thứ tự bằng nhau). Lưu trữ nhóm ẩn khóa học thuộc nhóm trên cả homepage và search, giữ nguyên dữ liệu để khôi phục. Không xóa cứng. Ảnh được kiểm tra MIME, chữ ký JPEG/PNG/WebP và kích thước 5 MB trên server; upload mới dùng UUID; upload thất bại khi lưu DB được dọn. Ảnh cũ được giữ để không phá URL đang dùng, cần retention job riêng nếu muốn thu hồi dung lượng.

`npm run test:cms-browser` chạy Chromium với HTTP fixture local: ảnh chụp `artifacts/cms-qa/`, viewport 375/768/1440. Fixture chỉ dùng trong test, không nằm trong production flow. Chạy `npx playwright install chromium` khi máy chưa có browser. Test này không thay thế đăng nhập, PostgREST và Storage integration trên project thật.


## Quiz Builder (09/10/2026)

Apply `0005_quiz_builder.sql` after 0004. Fresh installs can use the consolidated `schema.sql` instead of the migration chain; apply `seed.sql` only after all six migrations. Seed has eight participant field types and three question types. Do not reseed an active production quiz with participant history.

`/admin/quizzes` lists real records; `/new` creates a quiz; `/{id}`, `/{id}/fields`, `/{id}/questions`, `/{id}/settings` load the admin document. The tabs keep edits in memory; Save quiz persists the entire document atomically. Required content, unique slugs/field keys, one identifier, schedules, points, option correctness and accepted-answer normalization are validated on client and server. Dates use the browser timezone and are stored as timestamptz. Blank duration/attempt limit means unlimited. `show_rank` in the builder maps to the existing `show_ranking` database column.

Passwords are hashed server-side with scrypt and a unique 128-bit salt; no plaintext or hash is returned to the editor. Blank password preserves the current hash; Remove password clears it. SQL rejects unrecognized hash formats and password fields in document payloads. Admin-only RPC `admin_quiz_document` reads full answer keys; public question/option views remain strict allowlists. `admin_save_quiz` checks membership again, locks the quiz, checks updated_at, and replaces fields/questions/options/accepted answers in one transaction. Only trusted admin RPC can write these tables.

The runtime now captures attempt snapshots. Builder still protects the original FK history by blocking content/field/password changes after attempts; status and visibility remain editable. Start uses the same quiz lock as builder saves and the same participant validator as preview. Result Block Builder/analytics remain separate work.

Validation: `npm run verify`; `npm run test:quiz-builder` runs Chromium against the actual app and a PostgreSQL WASM-backed HTTP fixture. It covers all eight field types, all three question types, save/reload, reorder, points, delete, preview and server password hashing. This is not a Supabase cloud/PostgREST integration test.

## Public quiz runtime (migration 0006)

Apply `0006_public_quiz_runtime.sql` after 0005. It revokes anonymous/authenticated access to the old published quiz views and introduces a service-role-only transactional RPC. Configure `.env.local` with `SUPABASE_SERVICE_ROLE_KEY`, a random stable `QUIZ_SESSION_SECRET` of at least 32 characters, and the exact `NEXT_PUBLIC_SITE_URL` origin (HTTPS in production). Never use NEXT_PUBLIC for either secret. Missing configuration fails closed.

Flow: `/q/[slug]` checks the database clock/status → password unlock when needed → dynamic participant form → start → `/attempt/[id]` → server submit/grading → `/result/[id]` → leaderboard. `/info` and `/instructions` redirect to the dynamic entry form. No public quiz path falls back to demo answers/results.

Unlock uses a 256-bit opaque HttpOnly, SameSite=Strict cookie; only its SHA-256 hash is stored. HTTPS deployments use Secure cookies with the __Host- prefix (no Domain attribute), preventing sibling subdomains from overwriting these session cookies. Passwords travel only in POST JSON, never URLs. Unlock authorization lasts 1 hour; the opaque session can read owned attempts/results for 30 days and can be renewed after verifying the password. Post routes validate Origin and strict bounded JSON. Rate limits are stored atomically in PostgreSQL: 8 unlock checks/15 minutes per signed visitor/quiz plus 120/minute per quiz globally, including invalid passwords. No untrusted forwarded IP header is used as identity.

Start locks the quiz row, validates its current revision/schedule, validates participant data on the server, counts all prior attempts for the server-derived identity digest, captures a private question snapshot and sets `started_at`/deadline using the DB clock. A request UUID makes start retries idempotent; an existing active attempt for the same session is resumed. With an identifier field, normalization uses NFKC, trim, collapsed whitespace and lowercase; numbers additionally normalize leading/trailing zeroes. A keyed HMAC prevents offline guessing of the stored identity digest. Without an identifier, the limit is per signed browser cookie; clearing cookies/changing devices can create a different anonymous identity. A self-reported identifier is not verified identity—cross-device/person guarantees need authentication or OTP, outside this anonymous flow.

Autosave and submit lock the attempt and verify cookie ownership + slug. Only question IDs and answer values are accepted. Submit computes every grade from the snapshot and writes answers/score/counts/server `submitted_at`/duration in one transaction. Repeated/concurrent submit returns the stored result. `duration_ms = floor((submitted_at-started_at) in milliseconds)`; client scores/clocks/durations are rejected/ignored. Reload resumes the same server timestamps and last saved draft. The browser timer uses a monotonic display clock and polls server state. A request received after the deadline cannot replace answers: it grades only the last saved draft. Abandoned attempts finalize on the next owned get/submit or eligible start; there is no background scheduler. An offline client can lose answers not yet saved, and late submission duration includes the actual delay.

Result access requires the owning session. Score/correct/wrong counters follow show_score; rank follows show_ranking. Leaderboard order is score DESC, duration_ms ASC, submitted_at ASC, then UUID for a stable final tie; only explicitly flagged display fields become a name, never the full participant_data. Correct-answer review requires both owner submission and quiz closure plus show_correct_answers. Snapshot answer keys, password hashes, identity digests and tokens never appear in pre-submit DTOs/RSC/HTML/public Supabase queries.

Run `npm run verify`, `npm run test:public-quiz`, and `npm run test:smoke`. The public quiz E2E runs the production Next server against a local HTTP fixture backed by real PostgreSQL WASM and exercises the seeded quiz start→3/3 result→leaderboard, wrong/correct/no password, rate limits, CSRF, ownership, reload, duplicate and late submissions. It also scans HTML/RSC/API/bundles for a private seeded answer marker and server secrets. Tests validate locking logic and repeated requests on PGlite; multi-connection PostgreSQL contention and live Supabase Auth/PostgREST integration still require a provisioned project.

