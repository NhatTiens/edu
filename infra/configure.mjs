import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SITE_URL','SUPABASE_SERVICE_ROLE_KEY','QUIZ_SESSION_SECRET'];
function parse(file) {
  const result = {};
  for (const raw of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) throw new Error('Unsupported environment syntax. Use single-line KEY=value entries.');
    let value = match[2];
    if (value.startsWith('"')) { try { value = JSON.parse(value); } catch { throw new Error('Invalid quoted environment value.'); } }
    else if (value.startsWith("'")) {
      if (!value.endsWith("'")) throw new Error('Invalid quoted environment value.');
      value = value.slice(1, -1);
    } else value = value.replace(/\s+#.*$/, '').trim();
    if (/[\r\n\0]/.test(value)) throw new Error('Multiline environment values are unsupported.');
    result[match[1]] = value;
  }
  return result;
}
function validate(env) {
  for (const name of required) if (!env[name]) throw new Error(`Missing ${name}`);
  if (env.QUIZ_SESSION_SECRET.length < 32) throw new Error('QUIZ_SESSION_SECRET must contain at least 32 characters; reuse the existing secret.');
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing public Supabase key.');
  for (const name of ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    const key = env[name] || '';
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* publishable key need not be a JWT */ }
    if (key.startsWith('sb_secret_') || ['service_role','supabase_admin'].includes(role)) throw new Error(`Privileged key in ${name}`);
  }
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SITE_URL']) {
    const url = new URL(env[name]);
    if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password)
      throw new Error(`${name} must be an HTTP loopback origin for this local-only configuration.`);
  }
}
try {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22+ is required.');
  if (process.argv[2] === '--check') {
    // Runtime file uses Compose raw semantics; quotes and $ are literal.
    const env = Object.fromEntries(fs.readFileSync(path.join(root,'infra/.env.runtime'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>{ const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)]; }));
    validate(env);
    const build = parse(path.join(root,'infra/.env.compose'));
    for (const name of Object.keys(build).filter(k=>k.startsWith('NEXT_PUBLIC_'))) if ((env[name] || '') !== build[name]) throw new Error(`Build/runtime mismatch for ${name}. Reinitialize and rebuild explicitly.`);
    const port = Number(new URL(env.NEXT_PUBLIC_SITE_URL).port || 80);
    if (port !== Number(build.EDU_HTTP_PORT)) throw new Error('Site origin and published port differ.');
    const target = new URL(env.SUPABASE_INTERNAL_URL);
    if (!['http:','https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash || ['localhost','127.0.0.1','[::1]'].includes(target.hostname)) throw new Error('Invalid container transport origin.');
    console.log('Configuration valid; no secret values displayed.');
  } else {
    const source = path.resolve(process.argv[2] || path.join(root,'.env.local'));
    const destinations = ['.env.compose','.env.runtime'].map(x=>path.join(root,'infra',x));
    if (destinations.some(x=>fs.existsSync(x))) throw new Error('Deployment environment already exists. No files overwritten. Move the old deployment files to a private backup before reinitializing.');
    const env = parse(source);
    validate(env);
    const publicNames = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SITE_URL'];
    const publicValues = Object.fromEntries(publicNames.map(k=>[k,env[k] || '']));
    if (Object.values(publicValues).some(v=>/[\s$#'"\\]/.test(v))) throw new Error('Unsupported public configuration characters.');
    const sourceUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    const internal = process.argv[3] || `http://host.docker.internal:${sourceUrl.port || 80}`;
    const target = new URL(internal);
    if (target.protocol !== 'http:' || target.username || target.password || target.pathname !== '/' || target.search || target.hash || ['localhost','127.0.0.1','[::1]'].includes(target.hostname)) throw new Error('Use an HTTP container-reachable internal origin.');
    const runtime = { APP_DATA_MODE:'supabase', ...publicValues, SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY, QUIZ_SESSION_SECRET:env.QUIZ_SESSION_SECRET, SUPABASE_INTERNAL_URL:target.origin };
    const build = {...publicValues, EDU_HTTP_PORT:new URL(env.NEXT_PUBLIC_SITE_URL).port || '80', EDU_IMAGE_TAG:'local'};
    const serialize = value => Object.entries(value).map(([k,v])=>`${k}=${v}`).join('\n')+'\n';
    fs.writeFileSync(destinations[0],serialize(build),{flag:'wx',mode:0o600});
    fs.writeFileSync(destinations[1],serialize(runtime),{flag:'wx',mode:0o600});
    console.log('Created private deployment environment. Existing source environment and secrets unchanged.');
  }
} catch (error) { console.error(error instanceof Error && error.code ? `Deployment configuration error (${error.code}). Check that the source .env.local exists and is readable; ERR_INVALID_URL means a URL is malformed.` : error.message); process.exitCode=1; }
