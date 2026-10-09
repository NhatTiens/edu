import { CourseCard } from "./CourseCard";
import type { Course } from "@/lib/types";

export function CourseSection({ id, title, courses }: { id: string; title: string; courses: Course[] }) {
  return (
    <section className="course-section" id={id}>
      <div className="row-between" style={{marginBottom:14}}>
        <h2 className="section-title">🔥 {title}</h2>
        <a className="small" style={{color:"var(--blue)", fontWeight:800}} href="/search?q=all">Xem tất cả →</a>
      </div>
      <div className="grid-4">{courses.slice(0,4).map(course => <CourseCard key={course.id} course={course}/>)}</div>
    </section>
  );
}
