import { getPresentationDocument } from '@/lib/repositories/admin-site';
import { SiteSettings } from '@/components/admin/SiteSettings';
export default async function AdminSettings(){return <><h1 className="admin-page-title">Cài đặt</h1><SiteSettings initial={await getPresentationDocument()}/></>;}
