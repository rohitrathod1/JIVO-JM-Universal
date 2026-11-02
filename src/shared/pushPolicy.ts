import { notificationTarget } from './notificationTarget'

export function notificationPath(link: unknown): string {
  if (typeof link !== 'string') return '/'
  const target = notificationTarget(link)
  if (!target) return '/'
  const query = new URLSearchParams(target.params).toString()
  return target.pathname + (query ? '?' + query : '')
}
export function pushNotification(raw: unknown): { title: string; options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } } {
  const payload = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.slice(0, 200) : 'JIVO JM'
  const tag = typeof payload.tag === 'string' ? payload.tag.slice(0, 200) : undefined
  const silent = payload.silent === true
  return { title, options: {
    body: typeof payload.body === 'string' ? payload.body.slice(0, 2000) : '',
    icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag,
    silent, requireInteraction: payload.requireInteraction === true, renotify: payload.renotify === true && Boolean(tag),
    ...(!silent && Array.isArray(payload.vibrate) ? { vibrate: payload.vibrate.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0).slice(0, 10).map(value => Math.min(10000, Math.floor(value))) } : {}),
    data: { url: notificationPath(payload.url) },
  } }
}
export function focusedPushTarget(windowUrl: string, target: string, origin: string): boolean {
  try {
    const current = new URL(windowUrl); if (current.origin !== origin) return false
    const targetUrl = new URL(target, origin)
    const a = notificationTarget(current.pathname + current.search); const b = notificationTarget(targetUrl.pathname + targetUrl.search)
    return Boolean(a?.pathname === '/messenger' && b?.pathname === '/messenger' && a.params?.conversation && a.params.conversation === b.params?.conversation)
  } catch { return false }
}
