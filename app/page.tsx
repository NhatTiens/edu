import { Header } from '@/components/public/Header';
import { Hero } from '@/components/public/Hero';
import { CourseSection } from '@/components/public/CourseSection';
import { getSitePresentation } from '@/lib/repositories/site-settings';
import { getCatalog } from '@/lib/repositories/catalog';
export const dynamic='force-dynamic';
export default async function HomePage(){const [{sections,courses,banners},site]=await Promise.all([getCatalog(),getSitePresentation()]);const categories=[...new Set(courses.map(c=>c.category).filter(Boolean))];return <div className="page-shell"><Header/><main className="container"><Hero banners={banners}/><nav className="category-row" aria-label="Danh mục"><a className="category-pill" href="/search">Tất cả</a>{categories.map(c=><a className="category-pill" key={c} href={`/search?q=${encodeURIComponent(c)}`}>{c}</a>)}</nav><div id="courses"/>{!courses.length&&<p className="surface" style={{padding:24}}>Chưa có khóa học được xuất bản.</p>}{sections.map(s=><CourseSection key={s.id} {...s}/>)}</main><footer className="container muted small" style={{padding:'40px 0'}}>© {new Date().getFullYear()} {site.name}</footer></div>}

