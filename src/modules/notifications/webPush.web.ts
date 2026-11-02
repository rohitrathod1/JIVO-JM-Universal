import { api, errorMessage } from '../../core/api/client'
import { withSessionLock } from '../../core/auth/sessionCoordination'
import { deleteCurrentSubscription, getVapidKey, saveSubscription, sendTestPush } from './api'
import { PushController, type PushSupport } from './pushController'

const ownerKey = 'jm.push.binding'
const choiceKey = (owner: string) => `jm.push.${owner}`
let volatileBinding: { owner: string; endpoint: string } | null = null
function binding(): typeof volatileBinding {
  try { const raw: unknown = JSON.parse(localStorage.getItem(ownerKey) || 'null'); if (raw && typeof raw === 'object' && 'owner' in raw && 'endpoint' in raw && typeof raw.owner === 'string' && typeof raw.endpoint === 'string') return { owner: raw.owner, endpoint: raw.endpoint }; return null } catch { return volatileBinding }
}
function rememberBinding(value: typeof volatileBinding) { volatileBinding = value; try { if (value) localStorage.setItem(ownerKey, JSON.stringify(value)); else localStorage.removeItem(ownerKey) } catch { /* Browser storage may be blocked; this tab still keeps the cleanup binding. */ } }
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported'
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !navigator.locks) return ios && !installed ? 'ios-install' : 'unsupported'
  return Notification.permission === 'denied' ? 'denied' : 'supported'
}
async function registration(wait = true) {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing?.active) return existing
  if (!wait) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([navigator.serviceWorker.ready, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 5000) })]) }
  finally { clearTimeout(timer) }
}
async function verifyOwner(owner: string) {
  const me = await api.get<{ id: string }>('/me/')
  if (me.data.id !== owner) throw Error('Your account changed. Reopen notification preferences.')
}
async function disconnect(owner: string) {
  const saved = binding(); if (saved?.owner !== owner) return
  // Never delete the new account's current-session registration after its cookies changed.
  try { await verifyOwner(owner); const response = await deleteCurrentSubscription(); if (response.status >= 500) throw Error('Push cleanup could not reach the server.') } catch { /* Unsubscribing below revokes browser delivery even if logout already ended the session. */ }
  const reg = await registration(false)
  const sub = await reg?.pushManager.getSubscription()
  if (sub?.endpoint === saved.endpoint) await sub.unsubscribe()
  for (const notification of await reg?.getNotifications() ?? []) notification.close()
  if (binding()?.owner === owner && binding()?.endpoint === saved.endpoint) rememberBinding(null)
}
async function prepare(owner: string) {
  // Shared ownership is required for safe cleanup across tabs; fail before subscribing if unavailable.
  try { localStorage.setItem('jm.push.storage-check', '1'); localStorage.removeItem('jm.push.storage-check') } catch { throw Error('Allow browser storage for JM before enabling device notifications.') }
  const saved = binding()
  if (saved && saved.owner !== owner) await disconnect(saved.owner)
  if (!saved) await (await (await registration(false))?.pushManager.getSubscription())?.unsubscribe()
}
function keyBytes(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob((value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  const result = new Uint8Array(new ArrayBuffer(raw.length)); for (let index = 0; index < raw.length; index++) result[index] = raw.charCodeAt(index)
  return result
}
export const webPush = new PushController({
  support: pushSupport,
  permission: () => typeof Notification === 'undefined' ? 'default' : Notification.permission,
  requestPermission: () => Notification.requestPermission(),
  wants: owner => { try { return localStorage.getItem(choiceKey(owner)) === '1' } catch { return false } },
  remember: (owner, enabled) => { try { if (enabled) localStorage.setItem(choiceKey(owner), '1'); else localStorage.removeItem(choiceKey(owner)) } catch { /* Choice lasts for this session if browser preferences are blocked. */ } },
  lock: withSessionLock,
  prepare, disconnect,
  connect: async (owner, current) => {
    await verifyOwner(owner); if (!current()) return
    const reg = await registration(); if (!reg) throw Error('Notifications need the installed app files. Reload the page and try again.')
    const vapid = await getVapidKey(); if (!vapid.enabled || !vapid.key) throw Error('Push notifications are not set up on the server yet.')
    if (!current()) return
    const key = keyBytes(vapid.key); let sub = await reg.pushManager.getSubscription()
    const existing = sub?.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null
    if (sub && (!existing || existing.length !== key.length || existing.some((value, index) => value !== key[index]))) { await sub.unsubscribe(); sub = null }
    if (!current()) return
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    rememberBinding({ owner, endpoint: sub.endpoint })
    if (!current()) { await disconnect(owner); return }
    await verifyOwner(owner); if (!current()) { await disconnect(owner); return }
    await saveSubscription(sub.toJSON())
  },
  test: async owner => { await verifyOwner(owner); return (await sendTestPush()).devices },
  message: errorMessage,
})
