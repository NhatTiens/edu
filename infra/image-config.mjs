import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const publicNames = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SITE_URL'];
const manifest = new URL('./build-public.json', import.meta.url);
export function publicConfig(env) {
  const result = Object.fromEntries(publicNames.map(name=>[name, env[name] || '']));
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SITE_URL']) {
    let url;
    try { url = new URL(result[name]); } catch { throw new Error(`Missing or invalid ${name}`); }
    const loopback = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if (env.DEPLOYMENT_TARGET === 'vps' && (loopback || url.protocol !== 'https:')) throw new Error(`${name} must be a public HTTPS origin for VPS.`);
    if (url.username || url.password || url.pathname !== '/' || url.hash || url.search || !(url.protocol === 'https:' || (loopback && url.protocol === 'http:')))
      throw new Error(`${name} must be an HTTPS origin or HTTP loopback for local use.`);
  }
  if (!result.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !result.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing public Supabase key at build time.');
  for (const name of publicNames.filter(name=>name.endsWith('_KEY'))) {
    const key=result[name];
    let role;
    try { role=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role; } catch { /* Opaque publishable keys are supported. */ }
    if(key.startsWith('sb_secret_') || ['service_role','supabase_admin'].includes(role)) throw new Error(`Privileged key rejected in ${name}`);
  }
  return result;
}
export function verifyRuntime(env, built) {
  const actual = publicConfig(env);
  if ((env.DEPLOYMENT_TARGET || 'local') !== built.deploymentTarget) throw new Error('Image target differs from runtime target. Rebuild for local/VPS.');
  for (const name of publicNames) if (actual[name] !== built[name]) throw new Error(`Image/runtime mismatch: ${name}. Rebuild for the target environment.`);
  if (!env.SUPABASE_SERVICE_ROLE_KEY || (env.QUIZ_SESSION_SECRET || '').length < 32) throw new Error('Missing service key or valid quiz session secret.');
  let internal;
  try { internal = new URL(env.SUPABASE_INTERNAL_URL); } catch { throw new Error('SUPABASE_INTERNAL_URL is required in Docker.'); }
  if (!['http:','https:'].includes(internal.protocol) || internal.username || internal.password || internal.pathname !== '/' || internal.search || internal.hash || ['localhost','127.0.0.1','[::1]','0.0.0.0','[::]'].includes(internal.hostname))
    throw new Error('SUPABASE_INTERNAL_URL must point to the Supabase gateway, not container loopback.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'write') fs.writeFileSync(manifest, JSON.stringify({ ...publicConfig(process.env), deploymentTarget: process.env.DEPLOYMENT_TARGET || 'local' }), { mode: 0o644 });
    else if (process.argv[2] === 'check') verifyRuntime(process.env, JSON.parse(fs.readFileSync(manifest, 'utf8')));
    else throw new Error('Use write or check.');
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
