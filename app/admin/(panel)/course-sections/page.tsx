import Link from 'next/link';
import { listCms } from '@/lib/repositories/cms';
import { CmsList } from '@/components/admin/CmsList';
export default async function Page(){const records=await listCms('sections');return <><div className="row-between cms-heading"><h1 className="admin-page-title">Nhóm khóa học</h1><Link className="btn btn-primary" href="/admin/course-sections/new">+ Thêm mới</Link></div><CmsList kind="sections" records={records}/></>}
