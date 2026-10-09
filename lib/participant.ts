import { z } from 'zod';
import type { ParticipantField } from './public-quiz';
export function validateParticipant(fields:ParticipantField[],values:Record<string,unknown>){
 const errors:Record<string,string>={};
 for(const f of fields){const v=values[f.key];const empty=v===undefined||v===null||v===''||(typeof v==='string'&&!v.trim())||(Array.isArray(v)&&!v.length);
 if(empty){if(f.required)errors[f.key]='Trường bắt buộc.';continue;}
 if(f.type==='checkbox'){if(!Array.isArray(v)||v.some(x=>typeof x!=='string'||!f.options.includes(x))||new Set(v).size!==v.length)errors[f.key]='Lựa chọn không hợp lệ.';continue;}
 if(typeof v!=='string'||v.length>10000){errors[f.key]='Giá trị không hợp lệ.';continue;}
 if(f.type==='number'&&!/^-?\d+(\.\d+)?$/.test(v.trim()))errors[f.key]='Nhập một số hợp lệ.';
 if(f.type==='email'&&!z.email().safeParse(v.trim()).success)errors[f.key]='Email không hợp lệ.';
 if(f.type==='url'){try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();}catch{errors[f.key]='URL http/https không hợp lệ.';}}
 if(['radio','select'].includes(f.type)&&!f.options.includes(v))errors[f.key]='Lựa chọn không hợp lệ.';
 }return errors;
}
