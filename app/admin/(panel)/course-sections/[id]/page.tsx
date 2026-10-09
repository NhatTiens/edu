import { notFound } from 'next/navigation';
import { listCms } from '@/lib/repositories/cms';
import { CmsForm } from '@/components/admin/CmsForm';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const records=await listCms('sections');const record=records.find(r=>r.id===id);if(!record)notFound();return <><h1 className="admin-page-title">Sửa Nhóm khóa học</h1><section className="admin-card"><CmsForm kind="sections" record={record}/></section></>}

