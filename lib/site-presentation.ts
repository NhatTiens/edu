import { z } from 'zod';
import { validUrl } from './cms';
const url=z.string().max(2000).refine(v=>validUrl(v),'URL phải dùng http hoặc https.');
export const presentationSchema=z.object({name:z.string().trim().min(1).max(100),logo:url,facebook:url,zalo:url,title:z.string().trim().min(1).max(200),description:z.string().max(500),social_image:url}).strict();
export type SitePresentation=z.infer<typeof presentationSchema>;
export type PresentationDocument={value:SitePresentation;revision:string};
export const defaultPresentation:SitePresentation={name:'Học Online',logo:'',facebook:'https://facebook.com/',zalo:'',title:'Khóa học và kiểm tra online',description:'',social_image:''};
