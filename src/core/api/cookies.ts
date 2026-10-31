export async function csrfCookie(_url: string): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined
  const value = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith('jm_csrftoken='))?.slice('jm_csrftoken='.length)
  return value ? decodeURIComponent(value) : undefined
}
// HttpOnly browser cookies can only be revoked by the logout endpoint.
export async function clearNativeCookies(_url: string) {}
