import Link from "next/link";
import { Bell, Search } from "lucide-react";

export function Header() {
  return (
    <header className="public-header">
      <div className="container inner">
        <Link className="logo" href="/">
          <span className="logo-mark">∑</span>
          <span>HỌC ONLINE</span>
        </Link>
        <nav className="header-nav">
          <Link href="/#courses">Khóa học</Link>
          <Link href="/q/giai-tich-1-chuong-1-2">Kiểm tra</Link>
          <Link href="/search?q=giai+tich">Tài liệu</Link>
          <a href="https://facebook.com/" target="_blank" rel="noreferrer">Cộng đồng</a>
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
