import { z } from 'zod';
export const fieldTypes = ['text','number','email','url','select','radio','checkbox','textarea'] as const;
const text = z.string().trim().min(1,'Không được để trống.').max(2000);
const options = z.array(z.string().trim().min(1).max(500)).max(100);
export const fieldSchema = z.object({
 id:z.uuid(), label:text, key:z.string().regex(/^[a-z][a-z0-9_]{0,63}$/,'Key gồm chữ thường, số, gạch dưới; bắt đầu bằng chữ.'), type:z.enum(fieldTypes), placeholder:z.string().max(500), required:z.boolean(), options,
 sort_order:z.number().int().min(0), is_identifier:z.boolean(), show_on_leaderboard:z.boolean()
}).superRefine((f,ctx)=>{
 if(['constructor','prototype','__proto__'].includes(f.key))ctx.addIssue({code:'custom',path:['key'],message:'Key này được hệ thống dành riêng.'});
 if(['select','radio','checkbox'].includes(f.type) && !f.options.length)ctx.addIssue({code:'custom',path:['options'],message:'Nhập ít nhất một lựa chọn.'});
 if(new Set(f.options).size!==f.options.length)ctx.addIssue({code:'custom',path:['options'],message:'Lựa chọn bị trùng.'});
 if(f.is_identifier&&(!f.required||!['text','email','number'].includes(f.type)))ctx.addIssue({code:'custom',path:['is_identifier'],message:'Định danh phải bắt buộc và có loại text, email hoặc number.'});
});
export const questionSchema=z.object({
 id:z.uuid(),type:z.enum(['multiple_choice','true_false','short_answer']),content:text,points:z.number().finite().min(0).max(100000),sort_order:z.number().int().min(0),
 options:z.array(z.object({id:z.uuid(),content:text})).max(20),correct_option_id:z.string(),correct_boolean:z.boolean(),accepted_answers:options,case_insensitive:z.boolean()
}).superRefine((q,ctx)=>{
 if(q.type==='multiple_choice'){
  if(q.options.length<2)ctx.addIssue({code:'custom',path:['options'],message:'Cần ít nhất hai lựa chọn.'});
  if(!q.options.some(o=>o.id===q.correct_option_id))ctx.addIssue({code:'custom',path:['correct_option_id'],message:'Chọn một đáp án đúng.'});
  if(new Set(q.options.map(o=>o.content)).size!==q.options.length)ctx.addIssue({code:'custom',path:['options'],message:'Nội dung lựa chọn bị trùng.'});
 }
 if(q.type==='short_answer'){
  const normalized=q.accepted_answers.map(a=>normalizeShortAnswer(a,q.case_insensitive));
  if(!normalized.length)ctx.addIssue({code:'custom',path:['accepted_answers'],message:'Cần ít nhất một đáp án được chấp nhận.'});
  if(new Set(normalized).size!==normalized.length)ctx.addIssue({code:'custom',path:['accepted_answers'],message:'Đáp án bị trùng sau chuẩn hóa.'});
 }
});
const datetime=z.string().refine(v=>!v||Number.isFinite(Date.parse(v)),'Thời gian không hợp lệ.');
export const builderSchema=z.object({
 id:z.uuid().nullable(),updated_at:z.string().nullable(),title:text,slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),description:z.string().max(10000),
 duration_minutes:z.number().int().positive().max(10080).nullable(),open_at:datetime,close_at:datetime,attempt_limit:z.number().int().positive().max(10000).nullable(),status:z.enum(['draft','published','closed']),show_score:z.boolean(),show_rank:z.boolean(),show_correct_answers:z.boolean(),
 has_password:z.boolean(),password:z.string().max(128),remove_password:z.boolean(),fields:z.array(fieldSchema).max(50),questions:z.array(questionSchema).max(200)
}).superRefine((q,ctx)=>{
 if(q.password&&q.password.length<8)ctx.addIssue({code:'custom',path:['password'],message:'Mật khẩu ít nhất 8 ký tự.'});
 if(q.password&&q.remove_password)ctx.addIssue({code:'custom',path:['password'],message:'Chỉ chọn thay hoặc xóa mật khẩu.'});
 if(q.open_at&&q.close_at&&Date.parse(q.close_at)<=Date.parse(q.open_at))ctx.addIssue({code:'custom',path:['close_at'],message:'Ngày đóng phải sau ngày mở.'});
 if(q.status==='published'&&!q.questions.length)ctx.addIssue({code:'custom',path:['questions'],message:'Cần câu hỏi trước khi xuất bản.'});
 if(new Set(q.fields.map(f=>f.key)).size!==q.fields.length)ctx.addIssue({code:'custom',path:['fields'],message:'Key của field phải duy nhất.'});
 if(q.fields.filter(f=>f.is_identifier).length>1)ctx.addIssue({code:'custom',path:['fields'],message:'Chỉ chọn một field định danh.'});
 const ids=[...q.fields.map(f=>f.id),...q.questions.map(q=>q.id),...q.questions.flatMap(q=>q.options.map(o=>o.id))];
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'ID bị trùng.'});
});
export type QuizBuilderData=z.infer<typeof builderSchema>;
export type BuilderField=z.infer<typeof fieldSchema>;
export type BuilderQuestion=z.infer<typeof questionSchema>;
export function normalizeShortAnswer(value:string,insensitive=true){const trimmed=value.normalize('NFC').trim();return insensitive?trimmed.toLowerCase():trimmed;}
export function publicQuestion(q:BuilderQuestion){return {id:q.id,type:q.type,content:q.content,points:q.points,options:q.type==='short_answer'?[]:q.type==='true_false'?[{id:'true',content:'Đúng'},{id:'false',content:'Sai'}]:q.options.map(o=>({id:o.id,content:o.content}))};}
export { validateParticipant } from './participant';
export function newQuiz():QuizBuilderData{return {id:null,updated_at:null,title:'',slug:'',description:'',duration_minutes:30,open_at:'',close_at:'',attempt_limit:1,status:'draft',show_score:true,show_rank:true,show_correct_answers:false,has_password:false,password:'',remove_password:false,fields:[],questions:[]};}

