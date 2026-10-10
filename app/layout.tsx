import type { Metadata } from "next";
import "./globals.css";
import { getSitePresentation } from "@/lib/repositories/site-settings";
import { defaultPresentation } from "@/lib/site-presentation";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata():Promise<Metadata>{
 const site=await getSitePresentation().catch(()=>defaultPresentation);
 return {title:site.title,description:site.description||undefined,openGraph:{title:site.title,description:site.description||undefined,...(site.social_image?{images:[site.social_image]}:{})}};
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{isDemoMode() && <div role="status" style={{textAlign:"center",padding:6,background:"#fff2e7",color:"#864000"}}>Bản xem trước · Dữ liệu mẫu, bài làm không được lưu.</div>}{children}</body>
    </html>
  );
}
