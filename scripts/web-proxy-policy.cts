export function loopbackOrigin(value: string): string {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('The local proxy requires a plain loopback HTTP origin')
  return url.origin
}
export function socketOrigin(requestOrigin: string | undefined, publicOrigin: string, upstreamOrigin: string): string | null {
  // Validate the real browser origin BEFORE translating it for the existing local backend.
  return requestOrigin === publicOrigin ? upstreamOrigin : null
}
