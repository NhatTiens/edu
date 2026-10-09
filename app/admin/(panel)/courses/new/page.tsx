import { CmsForm } from '@/components/admin/CmsForm';
import { listCms } from '@/lib/repositories/cms';
export default async function NewCourse(){const sections=await listCms('sections'); return <><h1 className="admin-page-title">Thêm khóa học</h1><section className="admin-card" style={{maxWidth:900}}><CmsForm kind="courses" sections={sections}/></section></>}
