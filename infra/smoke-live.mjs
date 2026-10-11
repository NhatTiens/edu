// Read-only smoke against the real running app. No fixtures, seed, or user writes.
const base = process.argv[2] || 'http://127.0.0.1:3000';
async function get(route) {
  const r = await fetch(new URL(route, base), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${route}`);
  return r;
}
try {
  for (const [route, expected] of [['/api/health/live','ok'],['/api/health/ready','ready']]) {
    const data=await (await get(route)).json();
    if(data.status!==expected) throw new Error(`Invalid health response: ${route}`);
    console.log(`PASS ${route}`);
  }
  let homepage;
  for(const route of ['/','/search?q=deployment','/admin/login']) {
    const html=await (await get(route)).text();
    // Next can stream an error boundary with HTTP 200; don't accept that as success.
    if (/NEXT_HTTP_ERROR_FALLBACK|id="__next_error__"|"digest"\s*:\s*"\d+"|Không thể tải nội dung|Đã có lỗi xảy ra/i.test(html)) throw new Error(`Rendered error boundary: ${route}`);
    if(route==='/') homepage=html;
    console.log(`PASS rendered HTML ${route}`);
  }
  const assets=[...new Set([...homepage.matchAll(/(?:src|href)="(\/_next\/static\/[^"<>]+)"/g)].map(m=>m[1].replaceAll('&amp;','&')))];
  for(const ext of ['.css','.js']) if(!assets.some(a=>a.split('?')[0].endsWith(ext))) throw new Error(`Missing ${ext} asset references.`);
  for(const asset of assets) {
    const r=await get(asset);
    const type=r.headers.get('content-type') || '';
    if(asset.split('?')[0].endsWith('.css') ? !type.includes('text/css') : asset.split('?')[0].endsWith('.js') && !/javascript/.test(type)) throw new Error('Incorrect static asset MIME type.');
    await r.arrayBuffer();
  }
  console.log(`PASS ${assets.length} static assets including CSS and JavaScript`);
} catch(error) { console.error(error.message); process.exitCode=1; }
