import Link from 'next/link';
import { listCms } from '@/lib/repositories/cms';
import { CmsList } from '@/components/admin/CmsList';
export default async function Page(){const records=await listCms('courses');return <><div className="row-between cms-heading"><h1 className="admin-page-title">Khóa học</h1><Link className="btn btn-primary" href="/admin/courses/new">+ Thêm mới</Link></div><CmsList kind="courses" records={records}/></>}
