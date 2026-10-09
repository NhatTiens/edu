import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/auth/admin';
import { cmsTables, type CmsKind, type CmsRecord } from '@/lib/cms';
export async function cmsClient() { if (!await getAdmin()) throw new Error('Vui lòng đăng nhập bằng tài khoản quản trị.'); return createClient(); }
export async function listCms(kind: CmsKind): Promise<CmsRecord[]> {
 const client=await cmsClient();const {data,error}=await client.from(cmsTables[kind]).select('*').order('sort_order').order('id');if(error)throw new Error('Không thể tải dữ liệu. Kiểm tra kết nối và migration CMS.');return data as CmsRecord[];
}

