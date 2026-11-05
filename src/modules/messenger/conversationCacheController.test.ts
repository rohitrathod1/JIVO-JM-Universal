import { afterEach, expect, it, vi } from 'vitest'
import { ConversationCache, type CacheStorage, type CachedHistory } from './conversationCacheController'
import type { ConversationDetail, Message } from './api'
import { emptyWindow } from './lib/window'
const now = Date.parse('2026-11-02T08:00:00Z')
const detail = (id = 'c') => ({ id, title: 'Synthetic chat', locked: false, left: false }) as ConversationDetail
const message = (seq: number, extra: Partial<Message> = {}) => ({ id: `m${seq}`, conversation: 'c', seq, body: 'Synthetic only', expires_at: null, ...extra }) as Message
const history = (messages = [message(1)]): CachedHistory => ({ detail: detail(), window: { ...emptyWindow, visibleFrom: 1, messages } })
function fixture() {
 let value: string | null = null
 const storage: CacheStorage = { read: vi.fn(async () => value), write: vi.fn(async next => { value = next }), clear: vi.fn(async () => { value = null }) }
 let time = now
 return { storage, cache: new ConversationCache(storage, () => time), setTime: (next: number) => { time = next }, stored: () => value }
}
afterEach(() => vi.useRealTimers())
it('restores bounded recent history only after authenticated owner binding', async () => {
 const f = fixture(); await f.cache.bind('alice'); f.cache.put('c', history()); await f.cache.flush()
 const restarted = new ConversationCache(f.storage, () => now)
 expect(await restarted.get('c')).toBeNull()
 await restarted.bind('alice'); expect((await restarted.get('c'))?.window.messages[0].body).toBe('Synthetic only')
 await restarted.bind('bob'); expect(await restarted.get('c')).toBeNull(); expect(f.stored()).toBeNull()
})
it('clears history at sign-out and never restores it for a later account', async () => {
 const f = fixture(); await f.cache.bind('alice'); f.cache.put('c', history()); await f.cache.flush()
 await f.cache.bind(null); expect(f.stored()).toBeNull(); expect(await f.cache.get('c')).toBeNull()
 await f.cache.bind('alice'); expect(await f.cache.get('c')).toBeNull()
})
it('can preserve encrypted storage during session restore while denying all reads until validation', async () => {
 const f = fixture(); await f.cache.bind('alice'); f.cache.put('c', history()); await f.cache.flush()
 await f.cache.bind(null, undefined, true); expect(f.stored()).not.toBeNull(); expect(await f.cache.get('c')).toBeNull()
 await f.cache.bind('alice'); expect(await f.cache.get('c')).not.toBeNull()
})
it.each([10_000, 30 * 60_000])('denies expired sessions or cache age at the exact %sms boundary', async duration => {
 const f = fixture(); await f.cache.bind('alice', new Date(now + duration).toISOString()); f.cache.put('c', history()); await f.cache.flush()
 f.setTime(now + duration - 1); expect(await f.cache.get('c')).not.toBeNull()
 f.setTime(now + duration); expect(await f.cache.get('c')).toBeNull(); await f.cache.flush(); expect(f.stored()).toBeNull()
})
it('omits disappeared messages and messages outside the visible history floor', async () => {
 const f = fixture(); await f.cache.bind('alice')
 f.cache.put('c', { ...history([message(1), message(2, { expires_at: new Date(now + 1000).toISOString() }), message(3)]), window: { ...history().window, visibleFrom: 2, messages: [message(1), message(2, { expires_at: new Date(now + 1000).toISOString() }), message(3)] } })
 f.setTime(now + 1000); expect((await f.cache.get('c'))?.window.messages.map(m => m.seq)).toEqual([3])
})
it('removes locked or left conversations and strips unsafe list previews', async () => {
 const f = fixture(); await f.cache.bind('alice'); f.cache.put('c', history())
 f.cache.rememberList([{ ...detail(), last_message: { preview: 'private expired text' } } as ConversationDetail])
 expect((await f.cache.list())[0].last_message).toBeNull()
 f.cache.put('c', { ...history(), detail: { ...detail(), locked: true } })
 expect(await f.cache.get('c')).toBeNull(); expect(await f.cache.list()).toEqual([])
 f.cache.put('c', { ...history(), detail: { ...detail(), left: true } }); expect(await f.cache.get('c')).toBeNull()
})
it('bounds messages and never mutates server data or exposes the stored reference', async () => {
 const f = fixture(); await f.cache.bind('alice'); const original = history(Array.from({ length: 60 }, (_, i) => message(i + 1)))
 f.cache.put('c', original); const cached = (await f.cache.get('c'))!
 expect(cached.window.messages).toHaveLength(40); expect(cached.window.hasMoreBefore).toBe(true)
 cached.window.messages[0].body = 'changed'; expect((await f.cache.get('c'))?.window.messages[0].body).toBe('Synthetic only'); expect(original.window.messages).toHaveLength(60)
})
it('bounds the native snapshot by chat count and total serialized size', async () => {
 const f = fixture(); await f.cache.bind('alice')
 for (let i = 0; i < 15; i++) { const id = `c${i}`; f.cache.put(id, { detail: detail(id), window: { ...emptyWindow, messages: [message(1, { conversation: id, body: 'x'.repeat(30_000) })] } }) }
 await f.cache.flush(); expect(f.stored()!.length).toBeLessThanOrEqual(200_000); expect(await f.cache.get('c0')).toBeNull(); expect(await f.cache.get('c14')).not.toBeNull()
})
it('treats corrupt storage and invalid session expiry as unavailable cache', async () => {
 const storage: CacheStorage = { read: async () => '{broken', write: vi.fn(async () => {}), clear: vi.fn(async () => {}) }
 const cache = new ConversationCache(storage, () => now); await cache.bind('alice'); expect(await cache.get('c')).toBeNull(); expect(storage.clear).toHaveBeenCalled()
 await cache.bind(null); await cache.bind('alice', 'not a timestamp'); cache.put('c', history()); expect(await cache.get('c')).toBeNull()
})
it('accepts a successful request while protected storage hydration is still pending', async () => {
 let release!: (value: string | null) => void
 const storage: CacheStorage = { read: () => new Promise(r => { release = r }), write: vi.fn(async () => {}), clear: vi.fn(async () => {}) }
 const cache = new ConversationCache(storage, () => now); const binding = cache.bind('alice')
 await Promise.resolve(); await Promise.resolve(); cache.put('c', history()); release(null); await binding
 expect(await cache.get('c')).not.toBeNull()
})
it('does not restore a late previous-account storage read after a boundary', async () => {
 let release!: (value: string | null) => void
 const storage: CacheStorage = { read: vi.fn().mockImplementationOnce(() => new Promise(r => { release = r })).mockResolvedValue(null), write: vi.fn(async () => {}), clear: vi.fn(async () => {}) }
 const cache = new ConversationCache(storage, () => now); const binding = cache.bind('alice')
 await Promise.resolve(); await Promise.resolve(); const clearing = cache.bind(null)
 release(JSON.stringify({ version: 1, owner: 'alice', expires: now + 1000, histories: { c: history() }, items: [detail()] }))
 await binding; await clearing; expect(await cache.get('c')).toBeNull(); expect(await cache.list()).toEqual([])
})
it('coalesces rapid updates into a single protected snapshot write', async () => {
 vi.useFakeTimers(); const f = fixture(); await f.cache.bind('alice')
 f.cache.put('c', history([message(1)])); f.cache.put('c', history([message(1), message(2)]))
 await vi.advanceTimersByTimeAsync(499); expect(f.storage.write).not.toHaveBeenCalled()
 await vi.advanceTimersByTimeAsync(1); expect(f.storage.write).toHaveBeenCalledOnce(); expect(JSON.parse(f.stored()!).histories.c.window.messages).toHaveLength(2)
})
it('fails closed for malformed persisted history without leaking another conversation', async () => {
 const storage: CacheStorage = { read: async () => JSON.stringify({ version: 1, owner: 'alice', expires: now + 1000, items: [], histories: { c: { window: { messages: [] } } } }), write: vi.fn(async () => {}), clear: vi.fn(async () => {}) }
 const cache = new ConversationCache(storage, () => now); await cache.bind('alice')
 expect(await cache.get('c')).toBeNull(); expect(await cache.get('__proto__')).toBeNull()
})

it('honors a shortened session expiry even when binding the same account', async () => {
 const f = fixture(); await f.cache.bind('alice'); f.cache.put('c', history()); await f.cache.flush()
 await f.cache.bind('alice', new Date(now + 1000).toISOString()); f.setTime(now + 1000)
 expect(await f.cache.get('c')).toBeNull(); await f.cache.flush(); expect(f.stored()).toBeNull()
})
it('invalidates locked history even when removal arrives before protected hydration finishes', async () => {
 let release!: (value: string | null) => void
 const storage: CacheStorage = { read: () => new Promise(resolve => { release = resolve }), write: vi.fn(async () => {}), clear: vi.fn(async () => {}) }
 const cache = new ConversationCache(storage, () => now); const binding = cache.bind('alice')
 await Promise.resolve(); await Promise.resolve(); cache.remove('c')
 release(JSON.stringify({ version: 1, owner: 'alice', expires: now + 1000, items: [detail()], histories: { c: history() } })); await binding
 expect(await cache.get('c')).toBeNull(); expect(await cache.list()).toEqual([])
})
it('does not repeatedly rewrite protected storage when removing an already absent locked chat', async () => {
 vi.useFakeTimers(); const f = fixture(); await f.cache.bind('alice'); f.cache.remove('unknown'); await vi.advanceTimersByTimeAsync(500)
 expect(f.storage.write).not.toHaveBeenCalled()
})
it('evicts an unselected locked chat and rejects stale in-flight history and list responses', async () => {
 const f = fixture(); await f.cache.bind('alice'); f.cache.put('c', history()); f.cache.rememberList([detail()]); await f.cache.flush()
 f.cache.event({ type: 'CONVERSATION_SETTINGS', data: { conversation: 'c', locked: true } })
 f.cache.put('c', history()); f.cache.rememberList([detail()])
 expect(await f.cache.get('c')).toBeNull(); expect(await f.cache.list()).toEqual([])
 await f.cache.flush(); expect(JSON.parse(f.stored()!).histories.c).toBeUndefined()
 f.cache.event({ type: 'CONVERSATION_SETTINGS', data: { conversation: 'c', locked: false } })
 f.cache.put('c', history()); expect(await f.cache.get('c')).not.toBeNull()
})
it('retains lock-event concealment through pending hydration and resets it at the account boundary', async () => {
 let release!: (value: string | null) => void
 const storage: CacheStorage = { read: vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve })).mockResolvedValue(null), write: vi.fn(async () => {}), clear: vi.fn(async () => {}) }
 const cache = new ConversationCache(storage, () => now); const binding = cache.bind('alice')
 await Promise.resolve(); await Promise.resolve()
 cache.event({ type: 'CONVERSATION_SETTINGS', data: { conversation: 'c', locked: true } }); cache.put('c', history())
 release(JSON.stringify({ version: 1, owner: 'alice', expires: now + 1000, items: [detail()], histories: { c: history() } })); await binding
 expect(await cache.get('c')).toBeNull(); expect(await cache.list()).toEqual([])
 await cache.bind('bob'); cache.put('c', history()); expect(await cache.get('c')).not.toBeNull()
})
it('invalidates every cached chat on resync and rejects pre-resync detail and list responses', async () => {
 const f = fixture(); await f.cache.bind('alice'); const old = f.cache.generation()
 f.cache.put('c', history(), old); f.cache.rememberList([detail()], old)
 f.cache.event({ type: 'RESYNC', data: {} })
 f.cache.put('c', history(), old); f.cache.rememberList([detail()], old)
 expect(await f.cache.get('c')).toBeNull(); expect(await f.cache.list()).toEqual([])
 const fresh = f.cache.generation(); f.cache.put('c', history(), fresh); f.cache.rememberList([detail()], fresh)
 expect(await f.cache.get('c')).not.toBeNull(); expect(await f.cache.list()).toHaveLength(1)
})
it('resync during storage hydration also rejects queued pre-resync writes', async () => {
 let release!: (value: string | null) => void
 const storage: CacheStorage = { read: () => new Promise(resolve => { release = resolve }), write: vi.fn(async () => {}), clear: vi.fn(async () => {}) }
 const cache = new ConversationCache(storage, () => now); const binding = cache.bind('alice')
 await Promise.resolve(); await Promise.resolve(); const old = cache.generation(); cache.put('c', history(), old)
 cache.event({ type: 'RESYNC', data: {} }); cache.rememberList([detail()], old)
 release(JSON.stringify({ version: 1, owner: 'alice', expires: now + 1000, items: [detail()], histories: { c: history() } })); await binding
 expect(await cache.get('c')).toBeNull(); expect(await cache.list()).toEqual([])
})
