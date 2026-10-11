# Chạy Docker local với Supabase hiện hữu

Cấu hình này chỉ quản lý container Next.js thuộc Compose project `edu-local-web`. Nó không tạo, khởi động lại hoặc quản lý Supabase; không khai báo volume database, không reset, seed hay apply migration. Chưa chuyển sang Supabase Compose self-hosted.

## Điều kiện

Windows có Docker Desktop đang chạy Linux containers, Compose 2.30 trở lên, Node.js 22 trở lên và PowerShell 5.1 hoặc 7. Supabase local của đúng dự án đã chạy và `.env.local` đã hoạt động. Không dùng Docker context từ xa. Cần internet lần đầu để tải base image và dependencies. Không cần cài npm dependencies trên Windows để chạy các script cấu hình.

Giữ nguyên `NEXT_PUBLIC_SUPABASE_URL`, public key, service key và `QUIZ_SESSION_SECRET` hiện có. Public URL là `http://127.0.0.1:<port-thực-tế>` hoặc localhost để browser Windows truy cập. Server trong container dùng `SUPABASE_INTERNAL_URL=http://host.docker.internal:<cùng-port>`. Transport chỉ đổi đích request; URL ảnh public và tên cookie Auth không bị đổi. Nếu Supabase port chỉ bind loopback và Docker Desktop không chuyển tiếp được, bước probe sẽ dừng trước `up`; không tự mở DB ra LAN. Xem cấu hình Docker Desktop/firewall và kiểm tra cổng gateway API, không nhầm cổng PostgreSQL 54322 với API 54321.

`NEXT_PUBLIC_SITE_URL` phải đúng origin truy cập, ví dụ `http://localhost:3000`. Dừng riêng tiến trình `npm run dev` nếu nó chiếm cổng 3000; không dừng Supabase. Muốn dùng cổng khác, tạo một bản sao riêng của `.env.local`, sửa SITE_URL trong bản sao rồi truyền `-SourceEnv`. Cookies không phân biệt port; tránh đăng nhập đồng thời hai phiên app trên cùng hostname.

## PowerShell từ thư mục repository

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\scripts\Inspect-Local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\scripts\Initialize-Local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\scripts\Start-Local.ps1
```

Nếu có nhiều Supabase project, kiểm tra `docker ps` và chạy lại audit với đúng tên DB, ví dụ tên trả về từ máy bạn:

```powershell
.\infra\scripts\Inspect-Local.ps1 -DbContainer 'TEN_CONTAINER_DB_THUC_TE'
```

Không dùng chuỗi tên ví dụ như tên thật. Báo cáo lưu dưới `infra/reports/`, không đưa vào Git. Audit chỉ đọc DB bằng `BEGIN READ ONLY`, chỉ lấy số lượng và metadata, không xuất email, token, đáp án hay giá trị biến môi trường. Báo cáo chứa đường dẫn máy và metadata nên cần xem trước khi chia sẻ. Nếu `psql` bị từ chối, báo cáo ghi blocked; không tự thay password hoặc trust policy. Các schema/tables thiếu có thể khiến phần DB dừng; những mục khác vẫn được lưu.

Initialize tạo mới `infra/.env.compose` (cấu hình public cho build) và `infra/.env.runtime` (secret cho runtime), không ghi đè nếu đã tồn tại. Parser hỗ trợ KEY=value một dòng, giá trị có dấu nháy đơn hoặc nháy kép; không hỗ trợ shell expansion hay multiline. Không tự tạo hoặc đổi secret. Compose đọc runtime dạng raw để giữ nguyên `$` trong secret. File runtime chỉ chứa các biến được ứng dụng này sử dụng. Giữ file này trong tài khoản Windows của bạn, không đưa vào thư mục chia sẻ hoặc gửi kèm report.

Start kiểm tra config mà không in secret, build, chạy probe đọc Auth/PostgREST, rồi mới khởi chạy web và smoke test. Image build chạy typecheck, lint, production build. Secret không vào build context hoặc build args. Image chạy user `node`, port chỉ bind `127.0.0.1`, log có giới hạn, không mount Docker socket. Base image `node:22-bookworm-slim` là tag cập nhật; trước VPS cần pin digest đã kiểm thử và lưu image cũ để rollback.

```powershell
.\infra\scripts\Test-Local.ps1
.\infra\scripts\Stop-Local.ps1
```

Stop chỉ dừng web. Không chạy `docker compose down -v`, `docker system prune`, `supabase db reset`, `supabase stop --no-backup` hoặc xóa volume. Không áp dụng `schema.sql` lên database hiện hữu.

## Chẩn đoán

```powershell
docker compose --project-name edu-local-web --env-file .\infra\.env.compose -f .\infra\compose.local.yml ps
docker compose --project-name edu-local-web --env-file .\infra\.env.compose -f .\infra\compose.local.yml logs --tail 80 web
```

Không dùng `docker compose config` không có `--quiet`, hoặc xuất đầy đủ `docker inspect`: chúng có thể hiển thị secret. Người có quyền Docker vốn có thể đọc runtime environment; không chia sẻ quyền Docker cho người không tin cậy.

Nếu homepage báo lỗi dù HTTP 200, xem nội dung và log; smoke HTTP không thay thế kiểm thử dữ liệu thật. Nếu login redirect sai, kiểm tra SITE_URL chính xác, public/internal API URL và Auth allowlist ở cấu hình Supabase hiện hữu. Repo chưa có config.toml nên không tự tạo đè config Supabase nằm ở thư mục khác. Password login hiện có không dùng OAuth callback; các flow email/OAuth tương lai vẫn cần site URL/redirect allowlist đúng.

Nếu build thành công nhưng start/probe thất bại, không reset Supabase. App cũ đang chạy vẫn được giữ nếu probe trước `up` lỗi. Sau `up`, image cũ chỉ rollback được nếu đã giữ tag/digest riêng; không coi `restart: unless-stopped` là rollback. Thay public URL/key/site URL yêu cầu rebuild; thay runtime secret có thể làm mất hiệu lực session/identity nên phải có kế hoạch riêng.

## Backup trước khi chuyển dữ liệu

Lượt này không chuyển DB nên không tạo một bản backup giả định. Khi chuẩn bị self-hosted VPS, phải dừng các nguồn ghi trong một cửa sổ bảo trì và backup PostgreSQL đầy đủ (schema, dữ liệu public/auth/storage, extensions, grants và roles), file/object Storage thực tế, cấu hình Supabase, JWT/crypto keys và QUIZ_SESSION_SECRET. SQL dump `storage.objects` không chứa bytes ảnh. Không tar trực tiếp volume PostgreSQL đang ghi để coi là backup nhất quán.

Lưu backup mã hóa ngoài máy, manifest gồm image versions, migration history, mounts, object inventory và checksum; không lưu secret trong Git. Restore vào một stack biệt lập, tuyệt đối không trỏ restore vào volume gốc. Kiểm tra số lượng users/rows/objects, login mật khẩu cũ, đọc ảnh thật, quyền RLS, submit và ranking trước cutover. Đổi hostname cần kiểm tra URL ảnh đã lưu trong DB; transport giữ nguyên chúng trong local, không tự rewrite dữ liệu khi sang domain VPS.

## Tài liệu kỹ thuật đã đối chiếu

Next.js: https://nextjs.org/docs/app/guides/self-hosting

Docker: https://docs.docker.com/guides/nextjs/

Docker Desktop: https://docs.docker.com/desktop/features/networking/networking-how-tos/

## Image contract và healthcheck bổ sung

Dockerfile chính nằm tại root, stages là deps, builder, runner; Compose đã trỏ tới file mới. Next experimental serverActions bodySizeLimit được giữ nguyên. Runtime chỉ copy standalone traced dependencies và static assets, không copy node_modules của deps/builder. Node chạy non-root và ghi log trực tiếp stdout/stderr. `restart: unless-stopped` xử lý process exit; Docker healthcheck báo unhealthy nhưng bản thân nó không tự restart container còn sống.

`GET /api/health/live` kiểm tra Next API đang phục vụ, không phụ thuộc database. `GET /api/health/ready` dùng đúng server Supabase client, đọc tối đa một course ID, timeout 5 giây, trả 503 khi thiếu cấu hình/kết nối/quyền; response không chứa dữ liệu bản ghi hoặc chi tiết lỗi. Script smoke đọc các endpoint này, homepage/search/login và tải từng asset CSS/JS được tham chiếu trong homepage. Nó không submit quiz, thay database hoặc cấp quyền admin.

Docker builder ghi manifest gồm cấu hình public đã được dùng lúc build. Entrypoint đối chiếu manifest với runtime environment, yêu cầu internal URL không phải loopback và kiểm tra có server secrets; nếu khác public URL/key/site URL hoặc target local/VPS thì container từ chối khởi động. Manifest không chứa service key hay session secret. Chạy `docker compose restart` không cập nhật bundle hay environment: phải build rồi up lại bằng đúng file cấu hình.

## Build riêng cho VPS khi đã đủ điều kiện cutover

Không dùng image local cho VPS. Chuẩn bị hai file riêng từ `infra/vps.build.env.example` và `infra/vps.runtime.env.example`, lưu thành `infra/.env.vps.compose` và `infra/.env.vps.runtime`. Điền cùng bộ NEXT_PUBLIC_* thật trong cả hai. Public origins của target VPS bắt buộc HTTPS và không được loopback. SUPABASE_DOCKER_NETWORK phải là network của gateway Supabase self-hosted hiện hữu; SUPABASE_INTERNAL_URL dùng đúng DNS gateway/container port trên network đó, không dùng địa chỉ PostgreSQL. Template không tạo hoặc thay đổi Supabase, backup, reverse proxy hay TLS.

```bash
docker compose --env-file infra/.env.vps.compose -f infra/compose.vps.yml config --quiet
docker compose --env-file infra/.env.vps.compose -f infra/compose.vps.yml build web
docker compose --env-file infra/.env.vps.compose -f infra/compose.vps.yml run --rm --no-deps web node infra/check-runtime.mjs
docker compose --env-file infra/.env.vps.compose -f infra/compose.vps.yml up -d --no-deps --wait --wait-timeout 120 web
docker compose --env-file infra/.env.vps.compose -f infra/compose.vps.yml exec -T web node infra/smoke-live.mjs
```

Các lệnh trên chỉ dành cho VPS đã có stack và backup/restore kiểm chứng. Gateway network là external nên Compose không tạo/xóa network đó. Web bind loopback để reverse proxy trên host phục vụ HTTPS. Nếu proxy là container, cần thiết kế thêm network cho proxy trước. Test URL HTTPS bên ngoài, login/refresh, upload và quiz thật sau khi bật proxy; smoke trong container không xác minh TLS/domain.
