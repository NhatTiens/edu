"use client";
export default function Error({reset}:{reset:()=>void}){return <main className="container" style={{padding:24}}><h1>Không thể tải nội dung</h1><p>Vui lòng thử lại sau hoặc liên hệ quản trị viên.</p><button className="btn btn-primary" onClick={reset}>Thử lại</button></main>}
