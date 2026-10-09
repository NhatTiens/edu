import Link from "next/link";
import { BarChart3, BookOpen, ClipboardCheck, FolderKanban, Home, Image, Layers, Settings, Users } from "lucide-react";

const items = [
  ["/admin", Home, "Dashboard"], ["/", Layers, "Trang chủ"], ["/admin/banners", Image, "Banner"], ["/admin/course-sections", FolderKanban, "Nhóm khóa"], ["/admin/courses", BookOpen, "Khóa học"], ["/admin/quizzes", ClipboardCheck, "Bài kiểm tra"], ["/admin/quizzes/q1/participants", Users, "Người tham gia"], ["/admin/quizzes/q1/analytics", BarChart3, "Báo cáo"], ["/admin/settings", Settings, "Cài đặt"]
] as const;

export function AdminSidebar(){return <aside className="admin-sidebar"><Link className="logo" href="/admin"><span className="logo-mark">∑</span><span className="brand-text">HỌC ONLINE</span></Link><nav className="admin-nav">{items.map(([href,Icon,label])=><Link key={href} href={href} aria-label={label}><Icon size={17}/><span className="label-text">{label}</span></Link>)}</nav></aside>}

