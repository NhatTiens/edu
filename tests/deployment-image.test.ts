import test from 'node:test';
import assert from 'node:assert/strict';
import { publicConfig, verifyRuntime } from '../infra/image-config.mjs';
const local = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  SUPABASE_INTERNAL_URL: 'http://host.docker.internal:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-only',
  QUIZ_SESSION_SECRET: 'test-only-long-session-secret-123456789',
  DEPLOYMENT_TARGET: 'local',
};
test('image contract rejects stale public URL, wrong target, loopback transport and missing secrets', () => {
  const built = { ...publicConfig(local), deploymentTarget: 'local' };
  assert.doesNotThrow(()=>verifyRuntime(local,built));
  assert(!JSON.stringify(built).includes(local.SUPABASE_SERVICE_ROLE_KEY));
  assert(!JSON.stringify(built).includes(local.QUIZ_SESSION_SECRET));
  assert.throws(()=>verifyRuntime({...local,NEXT_PUBLIC_SITE_URL:'https://edu.example.com'},built),/mismatch/);
  assert.throws(()=>verifyRuntime({...local,SUPABASE_INTERNAL_URL:'http://localhost:54321'},built),/loopback/);
  assert.throws(()=>verifyRuntime({...local,QUIZ_SESSION_SECRET:''},built),/secret/);
  assert.throws(()=>verifyRuntime({...local,DEPLOYMENT_TARGET:'vps'},built),/HTTPS|target/);
});
test('VPS build requires HTTPS public origins and never embeds privileged keys', () => {
  assert.throws(()=>publicConfig({...local,DEPLOYMENT_TARGET:'vps'}),/HTTPS/);
  assert.throws(()=>publicConfig({...local,NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_test'}),/Privileged/);
  const env={...local,DEPLOYMENT_TARGET:'vps',NEXT_PUBLIC_SITE_URL:'https://edu.example.com',NEXT_PUBLIC_SUPABASE_URL:'https://supabase.example.com',SUPABASE_INTERNAL_URL:'http://gateway:8000'};
  const built={...publicConfig(env),deploymentTarget:'vps'};
  assert.doesNotThrow(()=>verifyRuntime(env,built));
});
