import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { mapCourse, searchCourses } from '@/lib/catalog';
export async function getCatalog() {
 const client=await createClient();
 const [sections,courses,banners]=await Promise.all([
  client.from('course_sections').select('*').eq('status','published').eq('is_published',true).order('sort_order').order('id'),
  client.from('courses').select('*').eq('status','published').eq('is_published',true).order('sort_order').order('id'),
  client.from('banners').select('*').eq('status','published').eq('is_published',true).order('sort_order').order('id')
 ]);
 if(sections.error||courses.error||banners.error)throw new Error('Không thể tải nội dung. Kiểm tra cấu hình Supabase.');
 const visible=courses.data.filter(c=>!c.section_id||sections.data.some(s=>s.id===c.section_id));
 const groups=sections.data.map(s=>({id:s.id,title:s.title,courses:visible.filter(c=>c.section_id===s.id).map(mapCourse)}));
 const ungrouped=visible.filter(c=>!c.section_id).map(mapCourse);if(ungrouped.length)groups.push({id:'ungrouped',title:'Khóa học khác',courses:ungrouped});
 return {courses:visible.map(mapCourse),sections:groups,banners:banners.data};
}
export async function findCourses(query:string){return searchCourses((await getCatalog()).courses,query);}

