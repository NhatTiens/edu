import 'server-only';
import { cmsClient } from './cms';
import type { PresentationDocument } from '@/lib/site-presentation';
export type Dashboard={courses:number;quizzes:number;attempts:number;today:number;days:{date:string;count:number}[];recent:{id:string;title:string;attempts:number;average_score:number|null}[]};
export async function getDashboard():Promise<Dashboard>{const client=await cmsClient();const {data,error}=await client.rpc('admin_dashboard');if(error)throw new Error('Không thể tải Dashboard. Kiểm tra migration 0012.');return JSON.parse(data);}
export async function getPresentationDocument():Promise<PresentationDocument>{const client=await cmsClient();const {data,error}=await client.rpc('admin_site_presentation',{});if(error)throw new Error('Không thể tải cài đặt. Kiểm tra migration 0012.');return JSON.parse(data);}
