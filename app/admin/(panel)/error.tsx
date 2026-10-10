"use client";
import { RetryButton } from "@/components/RetryButton";
export default function AdminError(){return <section className="admin-card"><h1>Không thể tải dữ liệu quản trị</h1><p>Kiểm tra kết nối và migration database rồi thử lại.</p><RetryButton/></section>;}
