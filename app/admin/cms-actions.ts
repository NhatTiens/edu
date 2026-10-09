"use server";
import { randomUUID } from 'node:crypto';
import { sanitizeImage } from '@/lib/services/image-upload';
import type { CourseRow, BannerRow, SectionRow } from '@/lib/supabase/database.types';
import { revalidatePath } from 'next/cache';
import { cmsClient } from '@/lib/repositories/cms';
import { cmsPayload, cmsTables, type CmsKind, type CmsResult } from '@/lib/cms';

export async function mutateCms(kind: CmsKind, operation: string, form: FormData): Promise<CmsResult> {
  if (process.env.APP_DATA_MODE === 'demo') return { ok: false, message: 'CMS chỉ ghi dữ liệu khi APP_DATA_MODE=supabase.' };
  let uploaded: { bucket: string; path: string } | undefined;
  const client = await cmsClient().catch(() => null);
  if (!client) return { ok: false, message: 'Phiên quản trị hết hạn. Vui lòng đăng nhập lại.' };
  try {
    if (!Object.hasOwn(cmsTables, kind)) throw new Error('Loại nội dung không hợp lệ.');
    const id = String(form.get('id') || '');
    const version = String(form.get('updated_at') || '');
    if (id && (!/^[0-9a-f-]{36}$/i.test(id) || !version)) throw new Error('Bản ghi không hợp lệ.');
    let payload: Partial<CourseRow & BannerRow & SectionRow>;
    if (operation === 'save') {
      payload = cmsPayload(kind, form);
      const file = form.get('image');
      if (file instanceof File && file.size) {
        if (kind === 'sections') throw new Error('Nhóm không hỗ trợ ảnh.');
        const bytes=await sanitizeImage(file);
        const bucket = kind === 'banners' ? 'homepage-banners' : 'course-thumbnails';
        const path = `${randomUUID()}.webp`;
        const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: 'image/webp', upsert: false });
        if (error) throw new Error('Upload thất bại. Kiểm tra bucket và quyền Storage.');
        uploaded = { bucket, path };
        payload[kind === 'banners' ? 'image_url' : 'thumbnail_url'] = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      } else if (form.get('remove_image') === 'on' && kind !== 'sections') payload[kind === 'banners' ? 'image_url' : 'thumbnail_url'] = null;
    } else {
      if (!id) throw new Error('Thiếu bản ghi.');
      if (operation === 'archive') payload = { status: 'archived', is_published: false };
      else if (operation === 'publish') payload = { status: 'published', is_published: true };
      else if (operation === 'hide') payload = { status: 'draft', is_published: false };
      else throw new Error('Thao tác không hợp lệ.');
    }
    const query = kind === 'courses'
      ? (id ? client.from('courses').update(payload as Partial<CourseRow>).eq('id',id).eq('updated_at',version) : client.from('courses').insert(payload as Partial<CourseRow>))
      : kind === 'banners'
      ? (id ? client.from('banners').update(payload as Partial<BannerRow>).eq('id',id).eq('updated_at',version) : client.from('banners').insert(payload as Partial<BannerRow>))
      : (id ? client.from('course_sections').update(payload as Partial<SectionRow>).eq('id',id).eq('updated_at',version) : client.from('course_sections').insert(payload as Partial<SectionRow>));
    const { data, error } = await query.select('id,updated_at').maybeSingle();
    if (error) throw new Error(error.code === '23505' ? 'Slug đã tồn tại. Hãy chọn slug khác.' : 'Không lưu được. Kiểm tra dữ liệu, kết nối và quyền quản trị.');
    if (!data) throw new Error('Dữ liệu đã thay đổi ở phiên khác. Tải lại trang trước khi sửa.');
    uploaded = undefined;
    revalidatePath('/'); revalidatePath('/search'); revalidatePath('/admin', 'layout');
    return { ok: true, message: 'Đã lưu thay đổi.', id: data.id, updated_at: data.updated_at };
  } catch (error) {
    if (uploaded) await client.storage.from(uploaded.bucket).remove([uploaded.path]);
    return { ok: false, message: error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.' };
  }
}


