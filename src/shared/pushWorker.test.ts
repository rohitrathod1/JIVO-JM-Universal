import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

const compile = (file: string) => ts.transpileModule(readFileSync(resolve(process.cwd(), file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import[^\n]+\n/gm, '').replace(/\bexport\s+(?=(?:function|const|let|class)\b)/g, '').replace(/export\s*\{\s*\};?\s*$/, '')
const worker = ['src/shared/notificationTarget.ts', 'src/shared/pushPolicy.ts', 'pwa/sw.ts'].map(compile).join('\n')
function fixture() {
  const handlers = new Map<string, (event: unknown) => void>(); const windows: { url: string; focused: boolean; visibilityState: string; focus: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> }[] = []
  const showNotification = vi.fn(async () => {}); const openWindow = vi.fn(async () => {}); let subscribed = true
  const scope = {
    addEventListener: (name: string, callback: (event: unknown) => void) => handlers.set(name, callback),
    location: { origin: 'https://jm.test' },
    registration: { pushManager: { getSubscription: async () => subscribed ? { endpoint: 'test-only' } : null }, showNotification },
    clients: { matchAll: async () => windows, openWindow },
  }
  runInNewContext(worker, { self: scope, importScripts: () => {}, __JM_PRECACHE__: [], __JM_BUILD__: 'test', URL, URLSearchParams })
  const dispatch = async (type: string, data: Record<string, unknown>) => { let pending = Promise.resolve(); handlers.get(type)?.({ ...data, waitUntil: (work: Promise<void>) => { pending = work } }); await pending }
  return { dispatch, windows, showNotification, openWindow, unsubscribe: () => { subscribed = false } }
}
it('does not display queued old-account content after browser unsubscribe', async () => {
  const f = fixture(); f.unsubscribe(); await f.dispatch('push', { data: { json: () => ({ title: 'Old account', body: 'Private' }) } })
  expect(f.showNotification).not.toHaveBeenCalled()
})
it('dispatches a safe notification and suppresses only the open focused chat', async () => {
  const f = fixture(); f.windows.push({ url: 'https://jm.test/messenger?conversation=a', focused: true, visibilityState: 'visible', focus: vi.fn(), postMessage: vi.fn() })
  await f.dispatch('push', { data: { json: () => ({ t: 'msg', url: '/messenger/a', title: 'A' }) } })
  expect(f.showNotification).not.toHaveBeenCalled()
  await f.dispatch('push', { data: { json: () => ({ t: 'msg', url: '/messenger/b?seq=3', title: 'B', silent: true, vibrate: [20] }) } })
  expect(f.showNotification).toHaveBeenCalledWith('B', expect.objectContaining({ silent: true, data: { url: '/messenger?conversation=b&seq=3' } }))
})
it('closes clicked notifications and never opens an external destination', async () => {
  const f = fixture(); const close = vi.fn()
  await f.dispatch('notificationclick', { notification: { close, data: { url: 'https://evil.test' } } })
  expect(close).toHaveBeenCalledOnce(); expect(f.openWindow).toHaveBeenCalledWith('/')
})
it('focuses an existing app and sends the canonical deep link through the worker message', async () => {
  const f = fixture(); const focus = vi.fn(async () => {}); const postMessage = vi.fn()
  f.windows.push({ url: 'https://jm.test/home', focused: false, visibilityState: 'hidden', focus, postMessage })
  await f.dispatch('notificationclick', { notification: { close: vi.fn(), data: { url: '/messenger?conversation=b&seq=3' } } })
  expect(focus).toHaveBeenCalledOnce(); expect(postMessage).toHaveBeenCalledWith({ type: 'JM_PUSH_NAVIGATE', url: '/messenger?conversation=b&seq=3' }); expect(f.openWindow).not.toHaveBeenCalled()
})
it('asks open apps to resync rotated subscriptions without requesting permission in the worker', async () => {
  const f = fixture(); const postMessage = vi.fn(); f.windows.push({ url: 'https://jm.test/home', focused: true, visibilityState: 'visible', focus: vi.fn(), postMessage })
  await f.dispatch('pushsubscriptionchange', {})
  expect(postMessage).toHaveBeenCalledWith({ type: 'JM_PUSH_CHANGED' })
})
