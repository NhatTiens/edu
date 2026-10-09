"use client";
export default function Error({reset}:{reset:()=>void}){return <div className="admin-card"><h2>Không thể tải quiz</h2><p>Kiểm tra phiên quản trị, kết nối Supabase và migration 0005.</p><button className="btn btn-primary" onClick={reset}>Thử lại</button></div>}
