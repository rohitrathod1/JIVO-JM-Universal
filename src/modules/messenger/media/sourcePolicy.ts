export function trustedMediaUri(uri: string, origin: string): boolean {
  try {
    const url = new URL(uri)
    return url.origin === new URL(origin).origin && !url.username && !url.password && !url.hash && /^\/api\/jm\/files\/[a-zA-Z0-9-]+\/$/.test(url.pathname)
  } catch { return false }
}
