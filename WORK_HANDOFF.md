# Handoff cho ChatGPT Work

Mục tiêu là biến scaffold này thành ứng dụng production-ready mà vẫn giữ FE gần mockup trong hội thoại.

Ưu tiên giữ nguyên visual language trong `app/globals.css`: nền sáng, thẻ trắng bo tròn, accent xanh/cam, course cards nhiều màu, quiz tập trung và admin sidebar tối.

Luồng public phải hoạt động hoàn chỉnh: trang chủ -> link quiz -> unlock bằng password -> form thông tin tùy admin -> bắt đầu attempt bằng server time -> làm bài -> submit một lần an toàn -> chấm ở server -> result -> leaderboard. Đáp án đúng tuyệt đối không gửi xuống client trước submit.

Admin cần Supabase Auth, middleware bảo vệ route, CRUD cho banners/course sections/courses/quizzes/fields/questions/result blocks, upload ảnh Supabase Storage, reorder, validation, toast, confirm dialog và trạng thái draft/published/closed.

Ranking: score DESC, duration_ms ASC, submitted_at ASC. Attempt limit phải dựa trên field định danh admin chọn, có thêm cookie/rate limiting hỗ trợ nhưng không dùng IP làm khóa chính.

Result builder phải hỗ trợ text, YouTube embed, external link, button, image và visibility rule after_submit / after_quiz_closed / scheduled_at.

Hãy chạy build, sửa type errors, bổ sung test cho scoring/ranking và kiểm tra responsive 375px, 768px, 1440px trước khi bàn giao.

## Tiếp quản 08/10/2026

Đã triển khai toolchain chạy được, repository catalog, đăng nhập và quyền admin, explicit demo mode cùng migration RLS. Đọc AUDIT_REPORT.md và TASKS.md để phân biệt phần đã thực hiện với scaffold còn lại. Chưa có Supabase project/credential nào được dùng. Không xem backend quiz là hoàn thành chỉ vì build pass: real-mode endpoints đang trả 501 một cách chủ động. Tiếp tục P1 rồi CRUD/quiz transaction theo thứ tự TASKS; giữ frontend hiện tại.
