export const cmsTables = { banners: 'banners', courses: 'courses', sections: 'course_sections' } as const;
export type CmsKind = keyof typeof cmsTables;
export type CmsRecord = { id: string; title: string; description: string | null; sort_order: number; is_published: boolean; status: string; updated_at: string; [key: string]: unknown };
export type CmsResult = { ok: boolean; message: string; id?: string; updated_at?: string };
export const IMAGE_LIMIT = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function validUrl(value: string, relative = false) {
  if (!value) return true;
  if (/[\\\s]/.test(value)) return false;
  if (relative && /^\/(?!\/)/.test(value)) return true;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
export function cmsPayload(kind: CmsKind, form: FormData) {
  const str = (key: string, max = 2000) => { const v = String(form.get(key) ?? '').trim(); if (v.length > max) throw new Error(`${key}: nội dung quá dài.`); return v; };
  const integer = (key: string, nullable = false) => { const v = str(key); if (!v && nullable) return null; if (!/^\d+$/.test(v) || Number(v) > 2147483647) throw new Error(`${key}: cần số nguyên không âm.`); return Number(v); };
  const link = (key: string, relative = false) => { const v = str(key); if (!validUrl(v, relative)) throw new Error(`${key}: URL không hợp lệ.`); return v || null; };
  const title = str('title', 200); if (!title) throw new Error('Vui lòng nhập tiêu đề.');
  const published = form.get('is_published') === 'on';
  const base = { title, description: str('description', 10000) || null, sort_order: integer('sort_order')!, is_published: published, status: published ? 'published' : 'draft' };
  if (kind === 'sections') return base;
  if (kind === 'banners') return { ...base, button_text: str('button_text', 100) || null, target_url: link('target_url', true), open_new_tab: form.get('open_new_tab') === 'on' };
  const slug = str('slug', 160); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Slug chỉ gồm chữ thường, số và dấu gạch ngang.');
  const section = str('section_id'); if (section && !/^[0-9a-f-]{36}$/i.test(section)) throw new Error('Nhóm không hợp lệ.');
  const theme = str('theme'); if (!['orange','blue','green','cyan'].includes(theme)) throw new Error('Màu không hợp lệ.');
  return { ...base, slug, section_id: section || null, price: integer('price'), old_price: integer('old_price', true), badge: str('badge', 100) || null, teacher_name: str('teacher_name', 200) || null, teacher_link: link('teacher_link'), course_link: link('course_link', true), category: str('category', 200) || null, theme };
}
