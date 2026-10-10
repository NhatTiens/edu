/* eslint-disable @next/next/no-img-element */
import { getSitePresentation } from "@/lib/repositories/site-settings";
import Link from "next/link";
import { Bell, Search } from "lucide-react";

export async function Header() {
  const site=await getSitePresentation();
  return (
    <header className="public-header">
      <div className="container inner">
        <Link className="logo" href="/">
          {site.logo?<img src={site.logo} alt="" width={34} height={34}/>:<span className="logo-mark">∑</span>}
          <span>{site.name}</span>
        </Link>
        <nav className="header-nav">
          <Link href="/#courses">Khóa học</Link>
          <Link href="/q/giai-tich-1-chuong-1-2">Kiểm tra</Link>
          <Link href="/search?q=giai+tich">Tài liệu</Link>
          {site.facebook&&<a href={site.facebook} target="_blank" rel="noopener noreferrer">Cộng đồng</a>}{site.zalo&&<a href={site.zalo} target="_blank" rel="noopener noreferrer">Zalo</a>}
        </nav>
        <div className="row">
          <form action="/search" className="header-search">
            <Search size={16} />
            <input name="q" aria-label="Tìm khóa học" className="input" placeholder="Tìm khóa học, chủ đề, video..." />
          </form>
          <Bell size={18} />
          <Link className="btn btn-primary" href="/admin/login">Đăng nhập</Link>
        </div>
      </div>
    </header>
  );
}
