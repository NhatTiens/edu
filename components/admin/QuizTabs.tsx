import Link from "next/link";
export function QuizTabs({id="q1",active="overview"}:{id?:string;active?:string}){
 const tabs=[['overview','Thông tin',`/admin/quizzes/${id}`],['fields','Form',`/admin/quizzes/${id}/fields`],['questions','Câu hỏi',`/admin/quizzes/${id}/questions`],['result','Kết quả',`/admin/quizzes/${id}/result-page`],['settings','Cài đặt',`/admin/quizzes/${id}/settings`]];
 return <div className="tabs">{tabs.map(([key,label,href],i)=><Link key={key} className={`tab ${active===key?'active':''}`} href={href}><span style={{opacity:.75,marginRight:5}}>{i+1}</span>{label}</Link>)}</div>
}
