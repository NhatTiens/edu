# Deployment local trước VPS

Cập nhật 11/10/2026. Baseline GitHub main: `b1e0d74b8268c270520f2607b2e9d293f7e3e76a`. Phạm vi chỉ deployment; frontend, CMS, quiz, grading và leaderboard giữ nguyên. Checklist sản phẩm trong TASKS.md không được viết lại.

## Những gì đã sẵn sàng

Source hiện có Next.js 16.4.0, React 19, lockfile, Node >=22 và migrations 0001 đến 0012. Tính năng hoàn thiện theo báo cáo người dùng và TASKS.md. Báo cáo QA trước đó trong repository dùng PostgreSQL WASM và HTTP fixtures; không dùng nó để khẳng định trạng thái Supabase trên Windows.

Môi trường Work thực tế là Ubuntu 24.04.3 x86_64, Node v24.19.0. Không có Docker CLI, Docker socket, hoặc kết nối điều khiển Docker Desktop của máy Windows. Vì vậy trạng thái containers, networks, volumes, ports, migrations đã áp dụng, Auth, Storage và DB trên máy người dùng hiện là CHƯA XÁC MINH. Không có .env.local/credential trong checkout và không yêu cầu gửi secret qua chat.

Đã thêm Dockerfile nhiều giai đoạn, standalone output, Compose chỉ chạy web, `.dockerignore`, cấu hình public/build và secret/runtime tách biệt. Server transport hỗ trợ đường về host, giữ nguyên public Storage URL và cookie namespace. Đã tạo script PowerShell audit chỉ đọc, initialize không ghi đè, build/start, dependency/HTTP smoke và stop riêng web. Không quản lý volume Supabase, không apply migration, không nạp seed và không chuyển dữ liệu.

## Những gì cần chạy trên Windows

Chạy Inspect-Local để xác minh OS, Node, Docker Desktop, daemon Linux, Compose >=2.30, Docker context, containers kể cả đã dừng, mounts, networks, volumes và cổng đang nghe. Khi có nhiều DB container, chọn đúng tên bằng -DbContainer. Kiểm tra report không có blocked trước khi kết luận DB được audit.

Đối chiếu 12 file migration với lịch sử DB. Script ghi các version chưa thấy, nhưng không chứng minh SQL đã áp dụng đúng checksum và không tự apply. Nếu lịch sử không có hoặc version khác quy ước, review schema và history trước; tuyệt đối không replay toàn bộ schema. Xác minh không còn migration đang chạy.

Đọc report Auth user count, Storage bucket/object counts, version/dung lượng PostgreSQL, estimates theo bảng và mount nguồn lưu trữ. Counts không thay thế kiểm tra dữ liệu ảnh và backup. So sánh số liệu trước/sau local deployment, giải thích mọi thay đổi do phiên test; không được mất dữ liệu cũ.

Chạy Initialize-Local với file môi trường đang hoạt động. Giữ nguyên keys và QUIZ_SESSION_SECRET; kiểm tra origin/site port. Kiểm tra gateway API Supabase từ Windows và từ probe container, giữ Auth site URL/redirect allowlist khớp nếu flow sử dụng chúng. Không tự mở cổng PostgreSQL ra internet.

Chạy Start-Local. Docker image build, Linux container runtime và kết nối Supabase thật chỉ được đánh dấu hoàn tất khi chạy trên máy này thành công. Không đổi sang self-hosted Supabase Compose trong giai đoạn local app-only.

## Rủi ro dữ liệu và cách kiểm soát

Compose app không sở hữu DB/Storage/Auth nên stop/recreate web không xóa các volume đó. Không dùng reset, prune, down -v, seed hoặc schema.sql trên dữ liệu hiện hữu. Ứng dụng thật vẫn có thể ghi dữ liệu khi người dùng thực hiện thao tác; các probe tự động chỉ đọc, manual lifecycle phải dùng quiz và participant thử nghiệm riêng.

QUIZ_SESSION_SECRET thay đổi sẽ ảnh hưởng nhận diện/session, JWT keys đổi có thể ảnh hưởng Auth. Không tự tái tạo secret hoặc copy secret vào Dockerfile. Runtime environment nằm trong file bị ignore; Docker admin có thể đọc nó nên bảo vệ tài khoản máy chủ. Không gửi file runtime, dump DB hay báo cáo chứa dữ liệu cá nhân lên Git.

Backup PostgreSQL đơn lẻ không đủ để phục hồi Storage bytes. Nếu chuyển stack/VPS: phải có backup đầy đủ, consistency window, manifest/checksum, bản sao ngoài máy và restore thử vào stack/volume riêng trước. Quy trình chi tiết trong infra/README.md. Chưa backup và chưa restore trong Work; không có bằng chứng để cho phép cutover hiện tại.

## Các bước kiểm thử chấp nhận

Trên Work: cài lockfile, typecheck, lint, unit/SQL regression, production standalone build; kiểm thử transport bảo toàn body/header/query và public Storage URL. Kiểm thử startup của standalone artifact và cấu hình deploy với dữ liệu giả trong thư mục tạm, không nối tới dữ liệu người dùng. Kết quả thực tế cuối lượt nằm ở cuối file này.

Trên Windows: kiểm tra container healthy, Auth health và public PostgREST probe; mở homepage, ảnh thật, khóa học và search. Đăng nhập admin đúng/sai, tải lại session, logout rồi truy cập /admin phải quay về login. Xác minh refresh token sau hết hạn access token. Không coi status 200 của login là xác nhận Auth thành công.

Dùng một quiz test riêng để kiểm tra password, start, autosave, reload, timer, submit, retry submit, result và leaderboard. So sánh grading/ranking mong đợi; kiểm tra không đọc được attempt của phiên khác và correct answer qua public request. Kiểm tra upload một ảnh test, đọc lại bytes sau restart riêng web, bảo đảm ảnh cũ còn đọc được. Dữ liệu kiểm thử chỉ được dọn bằng quy trình riêng đã thống nhất, script deployment không tự xóa.

Restart riêng container web rồi kiểm tra login và attempt có thể tiếp tục; PostgreSQL/Auth/Storage mounts và dữ liệu cũ phải nguyên vẹn. Chạy Test-Local và Inspect-Local lần nữa để giữ bằng chứng. Các E2E repository dùng fixture không được chạy nhầm với DB thật để coi là production acceptance.

## Điều kiện chuyển lên VPS

Phải hoàn tất audit máy thật, test local lifecycle, backup và restore rehearsal; chốt phiên bản/digest image Supabase và web; ghi rõ migration đã áp dụng; kiểm thử contention PostgreSQL nhiều connections. Chọn topology Supabase self-hosted phù hợp, không dùng Supabase CLI development stack như cấu hình production mặc định.

Cần domain HTTPS, reverse proxy có giới hạn request phù hợp upload 11 MiB, origin/CSRF/Auth allowlist đúng, firewall không public PostgreSQL/Studio, secret provisioning, giám sát disk/backup/error, retention và rollback với image cũ. Public NEXT_PUBLIC_* được đóng vào bundle nên đổi domain cần rebuild; kiểm tra và lập phương án URL Storage cũ, không tự sửa DB trong local deployment.

Chưa deploy VPS, chưa publish internet, chưa migrate dữ liệu. Quyết định cutover chỉ sau khi kiểm tra staging/restore chứng minh đạt các điều kiện trên.

## Kết quả kiểm chứng trong lượt này

`npm ci --no-audit --no-fund`, `npm run typecheck`, `npm run lint`, `npm test` (32/32) và `npm run build`: PASS. Build tạo standalone server; smoke bằng Node xác nhận login HTTP 200, admin chưa đăng nhập redirect về login và JavaScript tĩnh HTTP 200. Test không dùng credential thật.

Kiểm tra cấu hình trong thư mục tạm: PASS với secret chứa `$` và `#`, bảo toàn file nguồn, không đưa secret vào build config, từ chối ghi đè và phát hiện mismatch giữa build/runtime. PowerShell 7.4.6 parser: PASS cho cả 6 script. Đã chạy audit trên môi trường không có Docker và xác nhận ghi report blocked rõ ràng. Chưa chạy PowerShell 5.1 trên Windows, Docker build/runtime hoặc Supabase integration trên máy người dùng.

Compose 2.30.3 `config --quiet`: PASS với môi trường giả tạm thời, không dùng Docker daemon. Audit PowerShell cũng đã chạy qua nhánh đầy đủ bằng mock Docker (container discovery, metadata, truy vấn chỉ đọc và đối chiếu version migration): PASS. Đây là kiểm tra script/config, không phải bằng chứng container Windows hoặc dữ liệu Supabase thật đang hoạt động.

GitHub write integration trả HTTP 403 khi tạo tree; chưa tạo remote branch/PR và không có thay đổi trên GitHub. Bàn giao bằng patch dựa trên baseline b1e0d74; chạy `git apply --check` trước khi áp dụng vào checkout của người dùng. Không bypass quyền truy cập bằng phương thức khác.

## Bổ sung Docker runtime lần 2 — 11/10/2026

Tiếp tục từ patch local đã bàn giao, không làm lại sản phẩm. Theo log Windows do người dùng gửi, Docker Engine 29.5.3, Compose 5.1.4 và Linux/WSL2 đã chạy; ban đầu không có Supabase container/config hoặc .env.local. Sau đó người dùng báo đã chạy xong khởi tạo Supabase. Work chưa có log xác nhận migration/seed/start cuối cùng, chưa truy cập được credentials hoặc Docker daemon của Windows.

Dockerfile được chuyển từ infra/Dockerfile ra root, stages đổi đúng deps/builder/runner, Node 22 bookworm slim. Runtime dùng standalone traced files, chạy user node, không npm install ở runner, không next dev; stdout/stderr giữ trực tiếp, Compose dùng init và restart unless-stopped. Giữ nguyên experimental serverActions 11mb và giao diện. Không sửa migration, seed hoặc dữ liệu.

Thêm health API live (liveness) và ready (read-only Supabase SSR client, timeout 5 giây). Docker healthcheck chỉ dùng live để không đánh đồng DB outage với process chết. Live smoke kiểm tra ready, trang SSR, error boundary và CSS/JS với MIME đúng. Không có endpoint hoặc probe ghi dữ liệu trong các kiểm tra deployment mới.

Browser Supabase client giữ nguyên public URL; server clients/proxy tiếp tục dùng transport nội bộ đã test ở patch trước, không làm thay đổi public Storage URL hoặc Auth cookie name. Container entrypoint bắt buộc internal URL khác loopback. Manifest public được tạo lúc build, runtime phải khớp chính xác URL/key/site URL và target; mismatches bị từ chối với hướng dẫn rebuild. Manifest và build args không chứa service key/session secret; .dockerignore bổ sung secret files và Supabase temporary state.

Có Compose/template environment riêng cho VPS. Target VPS bắt buộc public HTTPS origins, không chấp nhận localhost, dùng external Supabase network hiện hữu. Không sao chép image local lên VPS. Các bước build lại, probe, up và smoke nằm trong infra/README.md; chưa deploy hoặc migrate VPS.

Kết quả: typecheck PASS, lint PASS, 34/34 tests PASS, production standalone build PASS. Standalone kiểm tra live 200, readiness thiếu DB trả 503 không tiết lộ lỗi, login 200 và 11 static CSS/JS assets 200. Compose local/VPS config validation PASS bằng Compose 2.30.3, PowerShell script parser PASS. Không dùng mock database để khẳng định homepage hoặc Supabase thật hoạt động; unit/database suite có fixtures biệt lập như trước và không thay dữ liệu ứng dụng.

Docker image build và container run trong Work: BLOCKED, `docker version` trả command not found (127), không có socket/remote context tới Windows. Homepage/Server Components với dữ liệu Supabase thật, Supabase server connection trong container và quiz API nghiệp vụ: CHƯA XÁC MINH trong lượt này. Chạy infra/scripts/Start-Local.ps1 trên Windows để build image, probe, khởi chạy container và smoke thật. Chỉ đánh dấu acceptance sau khi log các bước đó PASS; không reset DB khi có lỗi.
