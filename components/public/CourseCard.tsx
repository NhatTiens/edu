/* eslint-disable @next/next/no-img-element */
import type { Course } from "@/lib/types";
import { ExternalLink } from "lucide-react";

export function CourseCard({ course }: { course: Course }) {
  return (
    <article className="course-card">
      <div className={`course-thumb ${course.theme}`}>
        {course.thumbnail && <img src={course.thumbnail} alt={course.title} loading="lazy"/>}
        <span className="badge" style={{width:"fit-content", background:"rgba(255,255,255,.2)", color:"#fff"}}>{course.badge}</span>
        <div>
          <strong>{course.title}</strong>
          <div className="small" style={{opacity:.9, marginTop:4}}>{course.category}</div>
        </div>
        <span className="course-price-bubble">{course.price >= 1000 ? `${Math.round(course.price / 1000)}K` : `${course.price}đ`}</span>
      </div>
      <div className="course-body">
        <div className="course-name">{course.courseLink ? <a href={course.courseLink} target="_blank" rel="noopener noreferrer">{course.title}</a> : course.title}</div>
        {course.description && <p className="small muted">{course.description}</p>}
        <div className="row-between">
          <a aria-disabled={!course.teacherLink} className="teacher-link row" href={course.teacherLink} target="_blank" rel="noopener noreferrer">👤 {course.teacherName} <ExternalLink size={12}/></a>
        </div>
        <div className="row"><span className="price">{course.price.toLocaleString("vi-VN")}đ</span>{course.oldPrice && <span className="old-price">{course.oldPrice.toLocaleString("vi-VN")}đ</span>}</div>
      </div>
    </article>
  );
}


