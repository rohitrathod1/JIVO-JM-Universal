/// <reference lib="webworker" />
export {}

declare const self: ServiceWorkerGlobalScope
declare const __JM_PRECACHE__: readonly string[]
declare const __JM_BUILD__: string
declare function notificationPath(link: unknown): string
declare function pushNotification(raw: unknown): { title: string; options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } }
declare function focusedPushTarget(windowUrl: string, target: string, origin: string): boolean
importScripts('/share-worker.js')

const prefix = 'jm-universal-shell-'
const cacheName = prefix + __JM_BUILD__
const assets = new Set(__JM_PRECACHE__)
const shellRoute = /^\/(?:$|(?:login|home|share|messenger|profile|passwords|notifications|admin|preview|tools|approvals|alerts|atlas|group-info|group-edit)\/?$|(?:invite|reset-password)\/[^/]+\/?$)/

self.addEventListener('install', event => {
  // An incomplete download must never replace the working offline shell.
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    try {
      await cache.addAll(__JM_PRECACHE__.map(url => new Request(url, { cache: 'reload', credentials: 'omit' })))
    } catch (error) {
      // Do not retain a failed candidate as the "previous build" on the next update.
      await caches.delete(cacheName)
      throw error
    }
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep the preceding build for already-open tabs and their lazy-loaded assets.
    const owned = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName)
    await Promise.all(owned.slice(0, -1).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('range')) return
  // Only known application pages receive the public HTML shell. API, files, maps,
  // socket/admin endpoints, and arbitrary unknown paths always use the network.
  if (request.mode === 'navigate' && shellRoute.test(url.pathname)) {
    event.respondWith((async () => {
      const shell = await (await caches.open(cacheName)).match('/index.html')
      return shell ?? fetch(request)
    })())
    return
  }
  if (url.search || (!assets.has(url.pathname) && !/^\/(?:_expo\/static|assets)\//.test(url.pathname))) return
  event.respondWith((async () => {
    let cached = await (await caches.open(cacheName)).match(url.pathname)
    if (!cached) {
      const previous = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName)
      for (const name of previous) {
        cached = await (await caches.open(name)).match(url.pathname)
        if (cached) break
      }
    }
    // Do not turn authenticated runtime responses into a new cache entry.
    return cached ?? fetch(request)
  })())
})

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    // A queued delivery after unsubscribe/logout must not display old content.
    if (!await self.registration.pushManager.getSubscription()) return
    let raw: unknown = {}
    try { raw = event.data?.json() ?? {} } catch { raw = { title: 'JIVO JM', body: 'You have a new notification.' } }
    const notification = pushNotification(raw)
    const payload = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (payload.t === 'msg' && windows.some(client => client.focused && client.visibilityState === 'visible' && focusedPushTarget(client.url, notification.options.data.url, self.location.origin))) return
    await self.registration.showNotification(notification.title, notification.options)
  })())
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = notificationPath(event.notification.data?.url)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) { await existing.focus(); existing.postMessage({ type: 'JM_PUSH_NAVIGATE', url }); return }
    await self.clients.openWindow(url)
  })())
})
self.addEventListener('pushsubscriptionchange', event => {
  const change = event as ExtendableEvent
  change.waitUntil((async () => {
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ type: 'JM_PUSH_CHANGED' })
  })())
})
