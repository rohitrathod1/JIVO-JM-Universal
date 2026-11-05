import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({ owner: 'alice', saved: vi.fn(), removed: vi.fn() }))
vi.mock('../../core/api/client', () => ({ api: { get: async () => ({ data: { id: fake.owner } }) }, errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error' }))
vi.mock('../../core/auth/sessionCoordination', () => ({ withSessionLock: async <T>(work: () => Promise<T>) => work() }))
vi.mock('./api', () => ({
  getVapidKey: async () => ({ enabled: true, key: 'AQID' }),
  saveSubscription: fake.saved,
  deleteCurrentSubscription: async () => { fake.removed(); return { status: 204 } },
  sendTestPush: async () => ({ devices: 1 }),
}))
beforeEach(() => { vi.resetModules(); fake.owner = 'alice'; fake.saved.mockReset(); fake.removed.mockReset() })
afterEach(() => vi.unstubAllGlobals())
async function setup(owner = 'alice') {
  const values = new Map<string, string>(); const unsubscribed: string[] = []; let current: PushSubscription | null = null
  const make = (endpoint: string, key = [1, 2, 3]) => ({ endpoint, options: { applicationServerKey: new Uint8Array(key).buffer }, toJSON: () => ({ endpoint, keys: { auth: 'test', p256dh: 'test' } }), unsubscribe: async () => { unsubscribed.push(endpoint); current = null; return true } }) as unknown as PushSubscription
  const registration = { active: {}, getNotifications: async () => [], pushManager: { getSubscription: async () => current, subscribe: vi.fn(async () => { current = make('https://push.test/new'); return current }) } }
  const Notification = { permission: 'granted', requestPermission: vi.fn(async () => 'granted') }
  vi.stubGlobal('Notification', Notification)
  vi.stubGlobal('window', { isSecureContext: true, PushManager: class {}, Notification, matchMedia: () => ({ matches: false }) })
  vi.stubGlobal('navigator', { locks: {}, platform: 'Win32', maxTouchPoints: 0, userAgent: 'test', serviceWorker: { ready: Promise.resolve(registration), getRegistration: async () => registration } })
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  const { webPush } = await import('./webPush.web')
  const owned = (id: string, endpoint: string, key?: number[]) => { values.set('jm.push.binding', JSON.stringify({ owner: id, endpoint })); current = make(endpoint, key) }
  await webPush.bind(owner)
  return { webPush, values, unsubscribed, registration, Notification, owned }
}
it('never revokes a newer account’s endpoint when an old tab signs out', async () => {
  const f = await setup(); f.owned('bob', 'https://push.test/bob'); fake.owner = 'bob'
  await f.webPush.bind(null)
  expect(f.unsubscribed).toEqual([]); expect(fake.removed).not.toHaveBeenCalled()
})
it('unsubscribes the old browser endpoint after account change without deleting the new session’s binding', async () => {
  const f = await setup(); f.owned('alice', 'https://push.test/alice'); fake.owner = 'bob'
  await f.webPush.bind('bob')
  expect(f.unsubscribed).toEqual(['https://push.test/alice']); expect(fake.removed).not.toHaveBeenCalled(); expect(f.values.has('jm.push.binding')).toBe(false)
})
it('rotates a subscription with the wrong VAPID key and saves the replacement for the verified account', async () => {
  const f = await setup(); f.owned('alice', 'https://push.test/old', [9]); await f.webPush.enable()
  expect(f.unsubscribed).toContain('https://push.test/old'); expect(f.registration.pushManager.subscribe).toHaveBeenCalledOnce()
  expect(fake.saved).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://push.test/new' })); expect(f.values.get('jm.push.alice')).toBe('1')
})
it('refuses registration when shared cookies now belong to another account', async () => {
  const f = await setup(); fake.owner = 'bob'; await f.webPush.enable()
  expect(fake.saved).not.toHaveBeenCalled(); expect(f.registration.pushManager.subscribe).not.toHaveBeenCalled(); expect(f.webPush.snapshot().error).toContain('account changed')
})
