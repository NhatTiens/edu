import type { Course } from "./types";
import type { CourseRow } from "./supabase/database.types";
export function safeHttpUrl(value: string | null) {
  if (!value) return undefined;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}
export function mapCourse(row: CourseRow): Course {
  const themes = ["orange", "blue", "green", "cyan"] as const;
  return { id: row.id, title: row.title, slug: row.slug, category: row.category ?? "",
    teacherName: row.teacher_name ?? "", teacherLink: safeHttpUrl(row.teacher_link),
    courseLink: row.course_link && /^\/(?!\/)/.test(row.course_link) && !/[\\\s]/.test(row.course_link) ? row.course_link : safeHttpUrl(row.course_link ?? null),
    thumbnail: safeHttpUrl(row.thumbnail_url), description: row.description ?? undefined,
    price: row.price ?? 0, oldPrice: row.old_price ?? undefined, badge: row.badge ?? undefined,
    theme: themes.find(theme => theme === row.theme) ?? "orange", published: row.is_published };
}
export function searchCourses(courses: Course[], query: string) {
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  const needle = normalize(query.trim());
  return !needle || needle === "all" ? courses : courses.filter(c => normalize(`${c.title} ${c.category} ${c.teacherName}`).includes(needle));
}
