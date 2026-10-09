import { Header } from '@/components/public/Header';
import { CourseCard } from '@/components/public/CourseCard';
import { findCourses } from '@/lib/repositories/catalog';
export const dynamic='force-dynamic';
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){const p=await searchParams;const q=typeof p.q==='string'?p.q:'';const courses=await findCourses(q);return <><Header/><main className="container" style={{padding:'28px 0'}}><h1>Kết quả tìm kiếm cho “{q}”</h1><p className="muted">{courses.length} khóa học được tìm thấy</p>{!courses.length&&<p>Không có khóa học phù hợp. Thử từ khóa khác.</p>}<div className="grid-3">{courses.map(c=><CourseCard key={c.id} course={c}/>)}</div></main></>}

