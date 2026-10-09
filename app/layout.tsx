import type { Metadata } from "next";
import "./globals.css";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Học Tập Online",
  description: "Khóa học và kiểm tra trực tuyến",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{isDemoMode() && <div role="status" style={{textAlign:"center",padding:6,background:"#fff2e7",color:"#864000"}}>Bản xem trước · Dữ liệu mẫu, bài làm không được lưu.</div>}{children}</body>
    </html>
  );
}
