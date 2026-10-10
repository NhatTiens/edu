"use client";
import { RetryButton } from "@/components/RetryButton";
export default function Error(){return <div className="admin-card"><h2>Không thể tải quiz</h2><p>Kiểm tra phiên quản trị, kết nối Supabase và migration 0005.</p><RetryButton/></div>}
