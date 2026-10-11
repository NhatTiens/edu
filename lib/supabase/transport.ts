/** Server transport only: preserve public Storage URLs and the Auth cookie key.
 * Replacing the SDK's base URL would change both of those. Never import in client components.
 */
export function supabaseTransport(publicUrl: string, internalUrl = process.env.SUPABASE_INTERNAL_URL, transport: typeof fetch = fetch): typeof fetch {
  if (!internalUrl) return transport;
  const source = new URL(publicUrl);
  const target = new URL(internalUrl);
  for (const url of [source, target]) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      throw new Error('Supabase transport requires HTTP(S) origins without credentials or paths.');
  }
  return async (input, init) => {
    const original = input instanceof Request ? input.url : String(input);
    const url = new URL(original);
    if (url.origin !== source.origin) return transport(input, init);
    url.protocol = target.protocol;
    url.host = target.host;
    const request = input instanceof Request ? new Request(url, input) : url;
    // Do not forward privileged headers to a redirect destination.
    return transport(request, { ...init, redirect: 'error' });
  };
}
