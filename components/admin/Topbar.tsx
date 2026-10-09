import { Bell, Search } from "lucide-react";
import { logout } from "@/app/admin/logout";
export function AdminTopbar(){return <header className="admin-topbar"><div>Xin chào, <strong style={{color:"var(--blue)"}}>Admin</strong></div><div className="row"><Search size={17}/><Bell size={17}/><div className="avatar" style={{width:34,height:34,margin:0}}>A</div><form action={logout}><button className="btn btn-ghost" type="submit">Đăng xuất</button></form></div></header>}
