import 'server-only';
import sharp from 'sharp';
import { IMAGE_LIMIT,IMAGE_TYPES } from '@/lib/cms';
export async function sanitizeImage(file:File){
 if(!file.size||file.size>IMAGE_LIMIT||!IMAGE_TYPES.includes(file.type))throw new Error('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB.');
 const bytes=Buffer.from(await file.arrayBuffer());
 try {
  const image=sharp(bytes,{limitInputPixels:20000000,failOn:'warning',animated:false});const metadata=await image.metadata();
  const expected:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
  if(metadata.format!==expected[file.type]||!metadata.width||!metadata.height||(metadata.pages??1)>1)throw Error();
  // Re-encoding strips metadata, appended HTML/script and malformed polyglot content.
  const output=await image.rotate().webp({quality:85}).toBuffer();
  if(output.length>IMAGE_LIMIT)throw Error();return output;
 }catch{throw new Error('Ảnh không hợp lệ, quá lớn hoặc không khớp MIME type.');}
}
