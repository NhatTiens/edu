# Báo cáo tiếp quản EduQuiz

Thời điểm: 08/10/2026 theo giờ Việt Nam. Phạm vi: toàn bộ source trong archive được cung cấp, tài liệu bàn giao, product spec, package và SQL. Archive không có src; cấu trúc thực là app/components/lib/data. Ảnh tham chiếu đã được xem; CSS gốc được giữ nguyên.

## Kết luận

Source ban đầu là scaffold visual, chưa phải backend hoạt động. Cài đặt npm ban đầu thành công nhưng build/typecheck lỗi callback cookie Supabase implicit any; lint dùng next lint đã bị loại bỏ. Bản này đã sửa toolchain và bắt đầu implementation thực ở auth, catalog và RLS. Không xóa trang hoặc chức năng gốc để build pass. Chưa hoàn thiện engine quiz, CRUD quản trị, upload và analytics.

## Phát hiện theo module

| Phạm vi | Phát hiện ban đầu | Trạng thái sau lượt này |
| --- | --- | --- |
| package.json | Không lockfile, thiếu typecheck/test, next lint không chạy trên Next 16 | Lockfile, ESLint CLI, verify và smoke script đã có |
| lib/supabase | Cookie callback implicit any; SSR 0.6.1 lệch generic với supabase-js mới | SSR 0.12.7, callback typed, request-scoped clients, server-only boundary |
| Trang chủ/search | Toàn bộ courses mock, search trả mọi khóa, input tìm kiếm không submit | Catalog repository, sections thật, filter tiếng Việt và form GET đã nối |
| CourseCard/sections | Giá bubble luôn 99K, section trùng id=courses | Giá theo dữ liệu, id section riêng; URL giảng viên lọc HTTP(S) |
| Hero/category/branding | Nội dung cố định, liên kết quiz mẫu, không CMS | Còn việc P2 |
| Admin login/layout | Nút đăng nhập không hoạt động, admin mở tự do | Auth server action, proxy và membership guard đã triển khai; chỉ demo mode cho preview công khai |
| Admin toàn bộ CMS | Banners/sections/courses/quizzes/forms/settings chỉ input/nút, không persist | Visual giữ nguyên; CRUD/reorder/upload/confirm/toast vẫn cần triển khai |
| Admin quiz id | Tabs/sidebar nhiều nơi cố định q1, params id/attemptId bị bỏ qua | Ghi rõ vào P2, chưa nối record thật |
| Public quiz access/info/instructions | Password không kiểm tra, form không lưu, bắt đầu là link demo-attempt | Chỉ dùng làm preview; real mode chặn tới khi engine an toàn |
| Public attempt | Timer 28:42 cố định, câu 7/20 cố định, navigator/next/previous không hoạt động, submit là link | Chưa triển khai timer/answers/transaction; giữ scaffold |
| API unlock/start/submit | Luôn trả thành công giả, không validate slug/body/session | Giữ response demo có mode=mock khi bật demo; real mode trả 501 |
| Result/leaderboard | Điểm, rank, số người, thời gian cố định; video/PDF placeholder | Chưa nối engine/result rules; không hiện kết quả mẫu trong real mode |
| QuestionBuilder | Chỉ state đổi select; options và câu hỏi cố định, lưu/thêm không hoạt động | Còn P2; schema/backend phải xong trước UI persist |
| ResultBuilder | Blocks/button/URL/visibility chỉ giao diện | Còn P4; cần URL validation và visibility server |
| Scoring/ranking | Có helper thuần nhưng chưa được gọi từ backend | Thêm Unicode normalization, chặn đáp án rỗng, test thứ tự xếp hạng và không mutate |
| Mock data | 8 courses, quiz báo 20 câu nhưng chỉ 3 câu fixture, 8 ranking rows; thống kê admin viết inline | Fixtures giữ nguyên để tránh thay visual; không coi là dữ liệu thật |
| CSS/responsive | Có media queries; grid inline và header mobile có nguy cơ overflow; admin sidebar mobile bị ẩn | CSS không đổi; cần browser QA trước khi khẳng định responsive đạt |

## Database review

Schema gốc bật RLS cho các bảng quiz nhưng không có policy, khiến client thường không thể đọc/ghi chúng. Ba bảng course_sections/courses/banners chưa bật RLS. Password_hash và is_correct nằm cùng dữ liệu nghiệp vụ nên không thể cấp SELECT public rộng rãi. Không có admin membership, attempt identity, token ownership, uniqueness/locking cho attempt limit, transaction submit, snapshot đề, accepted-answer model rõ ràng hoặc storage policies.

Migration 0002 bổ sung admin_users với quyền chỉ xem membership của chính mình, is_admin security-definer có search_path cố định, admin-only policies và public SELECT chỉ dữ liệu catalog đã published. Các bảng quiz/answers/attempts không cấp quyền anonymous. Thêm check về giá/điểm/thời gian, composite FK để không gắn câu trả lời sang quiz khác, indexes cho thứ tự và ranking, trigger updated_at. Đây là nền tảng quyền truy cập, không phải triển khai đầy đủ transaction quiz.

RLS hiện áp dụng mô hình quản trị toàn website: mọi thành viên admin_users quản lý được tất cả tài nguyên. owner_id giữ lại để truy vết hoặc mở rộng; chưa có tenant isolation vì product spec chỉ mô tả quản trị website. Không cấp quyền theo metadata mà người dùng có thể tự sửa.

Các schema còn thiếu gồm identifier/display fields rõ ràng, participant identity digest, attempt session token hash, expires_at, snapshots, cài đặt randomization, chi tiết visibility/result controls, branding và storage. Những phần này nằm trong TASKS theo dependency; không tự tạo chính sách public cho đáp án trước khi backend bảo vệ được dữ liệu.

## Xác minh

### Bổ sung 09/10/2026

Migration `0003_production_foundation.sql` hoàn thiện phần còn thiếu của foundation: `profiles`, `admins`, `short_answer_accepted_answers`, `site_settings`, lifecycle `status`/`created_at`/`updated_at`, sort/index/constraint cho catalog và quiz. Các view `published_*` là allowlist DTO và không trả `is_correct`, accepted answers, password hash, participant data hoặc question settings. `supabase/seed.sql` tạo catalog, banner và quiz demo có đủ field/question/option/accepted-answer/result block. Repository quiz chỉ đọc các view an toàn; service-role client nằm trong boundary `server-only`.

Đã kiểm tra incremental migrations 0001 → 0003 và seed bằng PGlite, xác nhận anonymous đọc được quiz view published nhưng bị từ chối ở bảng câu hỏi, options, accepted answers, attempts và answers. Auth middleware hiện kiểm tra `admins` active, logout dùng server action, và vẫn có fallback đọc `admin_users` cho database đang nâng cấp.

`npm install` thành công. `npm run typecheck`, `npm run lint`, `npm test` và `npm run build` thành công trong môi trường Node 24.19.0. Có 8 test: scoring ba loại câu, câu bỏ trống, Unicode, ranking, tìm kiếm, URL, DTO mapping và migration/RLS. Test database chạy PostgreSQL WASM bằng PGlite, tạo role anon/authenticated và auth.uid giả lập. Test không thay thế Supabase integration thực. Extension pgcrypto được bỏ riêng trong harness vì PGlite có sẵn gen_random_uuid; SQL production vẫn giữ extension.

Smoke test khởi động production server ở demo và supabase mode, xác minh 27 route demo, search trả 5 khóa phù hợp, admin chưa cấu hình redirect đến login, ba API quiz trả 501 ở real mode và result demo không xuất hiện trên real-mode page. Root rendering được đặt dynamic để không đóng băng chế độ demo/quyền truy cập khi build rồi đổi runtime environment.

`npm audit --omit=dev --json` trả 0 lỗ hổng được registry báo cáo tại thời điểm chạy. Đây không phải bảo đảm không có lỗ hổng ứng dụng. Chưa chạy thành công visual QA 375/768/1440 vì browser binary không có và download Chromium trả archive lỗi. Chưa kiểm tra login thành công, refresh cookie, PostgREST hoặc migration trên Supabase thật do chưa có credential.

## Tài liệu kỹ thuật đã đối chiếu

ESLint CLI và proxy.ts dùng theo hướng dẫn Next.js 16 (Vercel, 2026). Auth dùng getUser để xác minh user với server và đọc admin_users; không dựa vào getSession hoặc user_metadata để cấp quyền (Supabase, 2026).

Vercel. (2026). ESLint configuration. https://nextjs.org/docs/app/api-reference/config/eslint

Vercel. (2026). Upgrading to version 16. https://nextjs.org/docs/app/guides/upgrading/version-16

Supabase. (2026). Creating a Supabase client for SSR. https://supabase.com/docs/guides/auth/server-side/creating-a-client

Supabase. (2026). JavaScript: getUser. https://supabase.com/docs/reference/javascript/auth-getuser

### Homepage CMS follow-up

0004 bổ sung grants CMS bị thiếu ở 0003, xóa published_read cũ tránh bypass status archived, chặn khóa học thuộc section ẩn, thay fallback admin_users bằng is_admin kiểm tra cả profiles/admins active. Homepage/search/course admin không còn mock import. Public banner và thumbnail nối Storage; mutation có require-admin, validation và concurrency check updated_at. Archive dùng confirm, không xóa dữ liệu. MIME/signature/5 MB được kiểm tra server; retained old images cần retention job riêng.

Kiểm tra local: verify pass (typecheck, lint, 10 tests, build); HTTP fixture Chromium pass 15 route/viewport checks và create/edit/hide/publish/archive/restore. Supabase live còn thiếu credential; không tự nhận đã provision project hoặc kiểm thử RLS Storage trên dịch vụ thật.

### Quiz Builder follow-up (09/10/2026)

Migration 0005 adds participant options/identity/display flags, case sensitivity and admin RPCs. Writes are transaction-scoped and revoked from authenticated direct table access. Admin document excludes hash/plaintext password; save accepts only a server-produced scrypt hash. Public DTO allowlists exclude all correctness and arbitrary settings. SQL row lock + updated_at protects replacement writes; attempts lock the same quiz row. Content edits are blocked after attempts; status/visibility edits remain allowed.

Builder UI and list now use real IDs and repository/service boundaries. Seed includes all eight form types and three question types. Local verification uses PGlite for database checks and Chromium with a PostgreSQL-backed HTTP fixture for the full UI. No live Supabase project credentials were available; production integration is still unverified. Public unlock/start/submit and result blocks remain later tasks.

### Public quiz runtime security audit (09/10/2026)

0006 revokes the old safe public views as well as keeping base answer/attempt tables inaccessible. Only service_role can call the runtime RPC; answer-bearing helper functions have PUBLIC/anon/authenticated execute revoked. Next server code exposes an explicit safe DTO and never passes inspect password_hash, participant_data, private snapshot or credentials to client components. Hash verification and visitor HMAC live behind server-only boundaries.

Start counts under a quiz row lock and captures snapshots; submit locks the attempt, validates ownership and question membership, ignores new answers after deadline, grades and timestamps in the same transaction. Ranking has all three required keys plus stable UUID. Results/board enforce flags and return only explicit display names. Review keys require closure as an additional release gate. Cookie ownership is not encoded in URLs.

Verification: unit/PGlite cases cover grading, canonical identities, server duration, attempts, retries/duplicate submit, stale/restricted access, rate counters, snapshots, expiry and view/RPC permissions. Browser E2E runs the seed through the production app with PostgreSQL WASM, including password and no-password routes, Origin rejection, HttpOnly, refresh, score 3/3, result and leaderboard. HTML/RSC/API and static bundles are checked against private seeded markers and service secrets. This does not claim a live Supabase deployment or genuine multi-connection contention testing.
