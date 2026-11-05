/** Matches the reference: opening JM selects Chats when available; Home remains a separate page. */
export function landingRoute(capabilities: readonly string[]): '/messenger' | '/home' {
  return capabilities.includes('JM_ACCESS') ? '/messenger' : '/home'
}

/** Same-app post-login destination, including future /share routes; never an external URL. */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/'
  try {
    const parsed = new URL(value, 'https://jm.invalid')
    if (parsed.origin !== 'https://jm.invalid' || parsed.pathname === '/login') return '/'
    let pathname = parsed.pathname
    for (let pass = 0; pass < 4; pass++) {
      if (pathname.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(pathname)) return '/'
      const decoded = decodeURIComponent(pathname)
      if (decoded === pathname) {
        const root = pathname.split('/')[1]
        return ['', 'home', 'messenger', 'passwords', 'profile', 'notifications', 'admin', 'share', 'preview'].includes(root) ? parsed.pathname + parsed.search + parsed.hash : '/'
      }
      pathname = decoded
    }
    return '/'
  } catch { return '/' }
}

export function greeting(now = new Date()): string {
  const hour = now.getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}
