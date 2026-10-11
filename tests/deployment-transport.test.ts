import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { supabaseTransport } from '../lib/supabase/transport';

test('Docker transport preserves method, body, headers, query and public Storage URL', async () => {
  const requests: Request[] = [];
  const fake: typeof fetch = async (input, init) => {
    requests.push(new Request(input, init));
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  };
  const transport = supabaseTransport('http://127.0.0.1:54321', 'http://host.docker.internal:54321', fake);
  await transport(new Request('http://127.0.0.1:54321/rest/v1/rpc/example?a=1', { method: 'POST', headers: { apikey: 'test-key' }, body: '{"test":true}' }));
  assert.equal(requests[0].url, 'http://host.docker.internal:54321/rest/v1/rpc/example?a=1');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].headers.get('apikey'), 'test-key');
  assert.equal(await requests[0].text(), '{"test":true}');
  assert.equal(requests[0].redirect, 'error');
  const client = createClient('http://127.0.0.1:54321', 'public-key', { global: { fetch: transport }, auth: { persistSession: false } });
  assert.equal(client.storage.from('site-assets').getPublicUrl('photo.webp').data.publicUrl, 'http://127.0.0.1:54321/storage/v1/object/public/site-assets/photo.webp');
});
test('Docker transport leaves unrelated URLs alone and rejects ambiguous origins', async () => {
  let result = '';
  const fake: typeof fetch = async input => { result = String(input); return new Response(); };
  assert.equal(supabaseTransport('http://localhost:54321', '', fake), fake);
  await supabaseTransport('http://localhost:54321', 'http://host.docker.internal:54321', fake)('https://example.com/test');
  assert.equal(result, 'https://example.com/test');
  for (const invalid of ['file:///tmp/test', 'http://user:password@host', 'http://host/path', 'http://host?x=1'])
    assert.throws(() => supabaseTransport('http://localhost:54321', invalid, fake));
});
