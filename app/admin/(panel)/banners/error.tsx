"use client";
export default function Error({reset}:{reset:()=>void}){return <div className="admin-card"><h2>Không thể tải nội dung</h2><p>Kiểm tra đăng nhập quản trị, cấu hình Supabase và migration CMS.</p><button className="btn btn-primary" onClick={reset}>Thử lại</button></div>}
