/** Resolve only server-relative media paths against the configured API origin. */
export function mediaUrl(path: string | null | undefined, origin: string): string | null {
  if (!origin || !path || !path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path)) return null
  try { const url = new URL(path, origin); return url.origin === new URL(origin).origin ? url.href : null } catch { return null }
}
