# Implementation status — Final QA

Ngày kiểm tra: 10/10/2026 (Asia/Ho_Chi_Minh). Baseline: upstream `d4ccb04` (`security audit`), branch local `qa/final`. Chưa push hoặc deploy.

## Phạm vi triển khai

CMS, Quiz Builder, public runtime, Result Builder, participants/detail/CSV, analytics và security follow-up đã có trong baseline. Lượt final QA sửa trực tiếp các lỗi còn lại:

| Phát hiện | Sửa đổi |
| --- | --- |
| Dashboard dùng số liệu/biểu đồ cố định | RPC admin-only lấy số thực, 7 ngày theo giờ Việt Nam, quiz gần đây và điểm trung bình đã nộp |
| Settings không lưu được cấu hình | Form/action/RPC thực, optimistic revision, branding/SEO/Facebook/Zalo, logo/social upload, bucket/policies `site-assets` |
| Branding không đồng bộ giao diện | Header, footer và metadata đọc presentation đã lưu; memoization trong cùng render |
| Hai ảnh settings hợp lệ có thể vượt tổng request 6 MiB | Giới hạn request 11 MiB cho hai ảnh, vẫn kiểm tra mỗi ảnh tối đa 5 MiB; E2E gửi hai PNG với tổng hơn 6 MiB |
| Login lỗi xóa cả email | Giữ email để nhập lại mật khẩu; pending button và lỗi vẫn hiển thị |
| Select khó xác định tên truy cập, nút reorder chỉ có ký hiệu | Accessible labels rõ ràng |
| Focus bàn phím và bảng mobile chưa đủ | Focus-visible, region có thể focus/cuộn ngang, kiểm tra không overflow trang |
| Nút retry không phục hồi Server Component bị lỗi | Retry tải request mới; dùng chung cho public/search/admin/quiz errors, có disabled/loading state |
| Browser fixtures cũ thiếu Origin/migrations mới | Đồng bộ fixture, script, full lifecycle E2E và viewport chính xác |

Không xóa tính năng để test pass. Migration `0012_final_qa.sql` là bổ sung; `schema.sql` đồng bộ cho cài mới.

## Kiểm chứng

| Lệnh | Kết quả |
| --- | --- |
| `npm install --prefer-offline --no-audit --no-fund` | PASS, dependency đã có trong lockfile |
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 30/30 |
| `npm run build` | PASS, production Next.js build |
| `npm run test:e2e` | PASS, cả 6 suite |

`test:e2e` chạy tuần tự: final QA, CMS, Quiz Builder, public quiz, Result Builder/results data và smoke. Production server thực; Chromium 133 được chọn qua `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Dữ liệu SQL được xử lý bởi PostgreSQL WASM (PGlite), với Auth/Storage HTTP adapter local chỉ dành cho test.

| Nhóm test | Hành vi được kiểm tra |
| --- | --- |
| Admin auth | Sai/đúng mật khẩu, pending, giữ email, cookie HttpOnly, logout và chặn truy cập lại |
| CMS/public | Tạo/sửa banner, tạo section/course, upload thumbnail và giải mã WebP, render homepage, search có/không kết quả, Facebook link mới không có opener |
| Quiz authoring | Password, publish, participant custom fields, multiple choice/true-false/short answer; suite Builder riêng kiểm tra cả 8 loại field |
| Participant | Sai/đúng password, nhập thông tin, start, reload giữ đáp án/started_at, timer giảm, chọn câu/nhập đáp án, submit, duplicate submit, kết quả 3/3 |
| Boundaries | Trước open_at, sau close_at, attempt limit, timeout auto-submit, 404 |
| Reports | Ranking/public leaderboard không có email private, YouTube URL canonical, Admin participant detail, analytics, CSV trong suite reports |
| Giao diện | 375×812, 768×1024, 1440×900; labels, keyboard focus, bảng cuộn, disabled controls, loading/empty/error states |
| Server failure | Ngắt catalog fixture, hiện lỗi, khôi phục kết nối và retry thành công |
| DevTools/security | Private answer marker và secret markers không có trong raw page source, hydrated HTML, RSC, network/API, compiled JS hoặc React props/state; SQL anon/non-admin bị từ chối trên nguồn đáp án |

E2E và SQL tests còn kiểm tra IDOR khác session/quiz, giả mạo thời gian/điểm, late answers, rate limits, CSRF, snapshot, stale revision và rollback. Bằng chứng này áp dụng cho các đường đi đã test, không phải chứng minh tuyệt đối mọi trạng thái ứng dụng.

## Điều kiện release còn lại

Chưa có credential Supabase thật trong workspace. Chưa xác minh live Auth token refresh/expiry, PostgREST grants, Storage policies thực, cạnh tranh nhiều connection PostgreSQL hoặc domain production. Facebook và YouTube được thay bằng external fixture trong E2E; chưa xác minh nhà cung cấp thực.

Trước deploy, backup và áp dụng migrations còn thiếu đến 0012, cấu hình secrets/origin HTTPS, chạy staging integration và production smoke. Với database đã ở 0011, chỉ chạy 0012; không chạy schema.sql trên dữ liệu hiện hữu. Không coi local QA là xác nhận release production.

Giới hạn identity ẩn danh, timeout không có sweeper, retention và dev dependency advisory nằm trong `SECURITY.md`; các công việc vận hành nằm trong `TASKS.md`.
