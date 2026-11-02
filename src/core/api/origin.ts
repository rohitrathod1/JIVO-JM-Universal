/** Browser cookies/CSRF and sockets share the deployed app's reverse-proxy origin. */
export function resolveApiOrigin(platform: string, configured?: string, browserOrigin?: string): string {
  if (platform === 'web') return browserOrigin && /^https?:\/\//.test(browserOrigin) ? browserOrigin.replace(/\/$/, '') : ''
  return (configured ?? '').replace(/\/$/, '')
}
