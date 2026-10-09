import Link from 'next/link';
import { listCms } from '@/lib/repositories/cms';
import { CmsList } from '@/components/admin/CmsList';
export default async function Page(){const records=await listCms('banners');return <><div className="row-between cms-heading"><h1 className="admin-page-title">Banner</h1><Link className="btn btn-primary" href="/admin/banners/new">+ Thêm mới</Link></div><CmsList kind="banners" records={records}/></>}
