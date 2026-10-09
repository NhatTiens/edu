import 'server-only';
import { cmsClient } from './cms';
import type { AdminResultDocument } from '@/lib/result-blocks';
export async function getResultDocument(id:string){if(!/^[a-f0-9-]{36}$/i.test(id))return null;const client=await cmsClient();const {data,error}=await client.rpc('admin_result_document',{p_id:id});if(error)throw new Error('Không thể tải Result Builder. Kiểm tra migration 0007.');return data?JSON.parse(data) as AdminResultDocument:null;}
