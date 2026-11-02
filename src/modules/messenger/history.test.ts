import { ConversationCache, type HistoryCache } from './conversationCacheController'
import { expect, it, vi } from 'vitest'
import { HistoryController } from './history'
import type { ConversationDetail, Message, MessageWindow, WindowQuery } from './api'
const msg = (seq: number) => ({ id: `m${seq}`, conversation: 'c', seq, body: `Message ${seq}` }) as Message
const page = (seqs: number[], extra: Partial<MessageWindow> = {}) => ({ results: seqs.map(msg), has_more_before: false, has_more_after: false, last_seq: seqs.at(-1) ?? 0, visible_from_seq: 1, receipts: { read_seq: 0, delivered_seq: 0 }, server_time: '2026-10-20T00:00:00Z', ...extra }) as MessageWindow
it('retains earlier history across unrelated events and scoped reconciliation', async () => {
  const read = vi.fn(async (_id: string, q?: WindowQuery) => q?.before ? page([1, 2]) : q?.changed_since ? page([], { results: [{ ...msg(3), body: 'Edited' }] }) : q?.after ? page([5]) : page([3, 4], { has_more_before: true }))
  const c = new HistoryController({ detail: async () => ({ id: 'c' }) as ConversationDetail, read, message: String })
  await c.select('c'); await c.page('before')
  c.event({ type: 'MESSAGE_CREATED', data: { ...msg(100), conversation: 'other' } }); expect(read).toHaveBeenCalledTimes(2)
  await c.reconcile(); expect(c.snapshot().window.messages.map(m => m.seq)).toEqual([1, 2, 3, 4, 5])
  expect(c.snapshot().window.messages[2].body).toBe('Edited')
})
it('ignores history responses after changing conversations', async () => {
  let resolve!: (value: MessageWindow) => void
  const c = new HistoryController({ detail: async id => ({ id }) as ConversationDetail, read: async id => id === 'old' ? new Promise(r => { resolve = r }) : page([7]), message: String })
  const old = c.select('old'); await c.select('new'); resolve(page([1])); await old
  expect(c.snapshot().id).toBe('new'); expect(c.snapshot().window.messages[0].seq).toBe(7)
})
it('provides newer navigation when an earlier window exceeds the memory cap', async () => {
  const c = new HistoryController({ detail: async () => ({ id: 'c' }) as ConversationDetail, read: async (_id, q) => q?.before ? page(Array.from({ length: 1000 }, (_, i) => i + 1)) : q?.after ? page([1001, 1002]) : page([1001, 1002], { has_more_before: true }), message: String })
  await c.select('c'); await c.page('before'); expect(c.snapshot().window.hasMoreAfter).toBe(true)
  await c.page('after'); expect(c.snapshot().window.messages.at(-1)?.seq).toBe(1002); expect(c.snapshot().window.hasMoreBefore).toBe(true)
})

it('applies queued edits and receipts after an in-flight history response', async () => {
  let resolve!: (value: MessageWindow) => void
  const c = new HistoryController({ detail: async () => ({ id: 'c' }) as ConversationDetail, read: async () => new Promise(r => { resolve = r }), message: String })
  const opening = c.select('c')
  c.event({ type: 'MESSAGE_UPDATED', data: { conversation: 'c', seq: 1, body: 'Changed during load', edited_at: 'now', updated_at: 'now', mentions: [] } })
  c.event({ type: 'MESSAGE_READ', data: { conversation: 'c', receipts: { read_seq: 1, delivered_seq: 1 } } })
  resolve(page([1])); await opening
  expect(c.snapshot().window.messages[0].body).toBe('Changed during load'); expect(c.snapshot().window.receipts.read_seq).toBe(1)
})
it('updates reactions and deletion without replacing the loaded history', async () => {
  const c = new HistoryController({ detail: async () => ({ id: 'c' }) as ConversationDetail, read: async () => page([1, 2, 3]), message: String }); await c.select('c')
  c.event({ type: 'REACTION_UPDATED', data: { conversation: 'c', seq: 2, reactions: [{ emoji: 'ok', count: 1, me: true }] } })
  c.event({ type: 'MESSAGE_DELETED', data: { conversation: 'c', seq: 3, by_moderator: true, updated_at: 'now' } })
  expect(c.snapshot().window.messages.map(m => m.seq)).toEqual([1, 2, 3]); expect(c.snapshot().window.messages[1].reactions).toHaveLength(1); expect(c.snapshot().window.messages[2].deleted).toBe(true)
})

it('clears inaccessible history and rejects a late in-flight response', async () => {
 let deny = false; let resolve!: (value: MessageWindow) => void; let delay = false
 const c = new HistoryController({ detail: async () => { if (deny) throw { response: { status: 403, data: { code: 'forbidden' } } }; return { id: 'c' } as ConversationDetail }, read: async () => delay ? new Promise(r => { resolve = r }) : page([1, 2]), message: String })
 await c.select('c'); delay = true; const pending = c.latest(); deny = true; await c.refreshDetail()
 expect(c.snapshot().accessLost).toBe(true); expect(c.snapshot().detail).toBeNull(); expect(c.snapshot().window.messages).toEqual([])
 resolve(page([1, 2])); await pending; c.event({ type: 'MESSAGE_CREATED', data: msg(3) }); expect(c.snapshot().window.messages).toEqual([])
})
it.each([undefined, 500, 429])('preserves history on transient status %s', async status => {
 let fail = false; const c = new HistoryController({ detail: async () => { if (fail) throw { response: status ? { status } : undefined }; return { id: 'c' } as ConversationDetail }, read: async () => page([1]), message: String })
 await c.select('c'); fail = true; await c.refreshDetail(); expect(c.snapshot().accessLost).toBe(false); expect(c.snapshot().window.messages).toHaveLength(1)
})
it('keeps the older window and records incoming messages beyond it', async () => {
 const c = new HistoryController({ detail: async () => ({ id: 'c' }) as ConversationDetail, read: async () => page([1, 2], { has_more_after: true, last_seq: 10 }), message: String })
 await c.select('c'); c.event({ type: 'MESSAGE_CREATED', data: msg(11) }); expect(c.snapshot().window.messages.map(m => m.seq)).toEqual([1, 2]); expect(c.snapshot().window.lastSeq).toBe(11)
})
it('retains an outbox-delivered message while an older latest page is in flight',async()=>{
 let resolve!:(value:MessageWindow)=>void
 const read=vi.fn(async()=>page([1]));const c=new HistoryController({detail:async()=>({id:'c'}) as ConversationDetail,read,message:String});await c.select('c');read.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));const loading=c.latest();c.event({type:'MESSAGE_CREATED',data:msg(2)});resolve(page([1]));await loading;expect(c.snapshot().window.messages.map(m=>m.seq)).toEqual([1,2])
})

it('falls back to recent account-bound cache only for network failure', async () => {
 const { AxiosError } = await import('axios')
 const saved = { detail: { id: 'c' } as ConversationDetail, window: { messages: [msg(1)], hasMoreBefore: false, hasMoreAfter: false, lastSeq: 1, visibleFrom: 1, receipts: { read_seq: 0, delivered_seq: 0 }, serverTime: null } }
 const cache = { get: vi.fn(async () => saved), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
 const c = new HistoryController({ detail: async () => { throw new AxiosError('offline') }, read: async () => page([1]), message: String, cache })
 await c.select('c'); expect(c.snapshot().cached).toBe(true); expect(c.snapshot().window.messages[0].id).toBe('m1'); expect(cache.put).not.toHaveBeenCalled()
})
it('does not expose cached messages after authorization failure or request cancellation', async () => {
 const { CanceledError } = await import('axios')
 for (const error of [{ response: { status: 403, data: { code: 'forbidden' } } }, new CanceledError('abandoned')]) {
  const cache = { get: vi.fn(async () => null), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
  const c = new HistoryController({ detail: async () => { throw error }, read: async () => page([1]), message: String, cache })
  await c.select('c'); expect(cache.get).not.toHaveBeenCalled(); expect(c.snapshot().window.messages).toEqual([])
 }
})
it('persists synchronized changes and invalidates the cache on lost access', async () => {
 const cache = { get: vi.fn(async () => null), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
 let refused = false
 const c = new HistoryController({ detail: async () => { if (refused) throw { response: { status: 404 } }; return { id: 'c' } as ConversationDetail }, read: async () => page([1]), message: String, cache })
 await c.select('c'); c.event({ type: 'MESSAGE_DELETED', data: { conversation: 'c', seq: 1, updated_at: 'now' } })
 expect(cache.put.mock.calls.at(-1)?.[1].window.messages[0].deleted).toBe(true)
 refused = true; await c.refreshDetail(); expect(cache.remove).toHaveBeenCalledWith('c'); expect(c.snapshot().accessLost).toBe(true)
})
it('hides locked history and rejects an older read after the lock event', async () => {
 let release!: (page: MessageWindow) => void
 const read = vi.fn(async () => page([1]))
 const cache = { get: vi.fn(async () => null), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
 const c = new HistoryController({ detail: async () => ({ id: 'c', locked: false }) as ConversationDetail, read, message: String, cache })
 await c.select('c'); read.mockImplementationOnce(() => new Promise(r => { release = r })); const loading = c.latest()
 c.event({ type: 'CONVERSATION_SETTINGS', data: { id: 'c', locked: true } })
 release(page([1, 2])); await loading
 expect(c.snapshot().window.messages).toEqual([]); expect(c.snapshot().locked).toBe(true); expect(c.snapshot().accessLost).toBe(false); expect(cache.remove).toHaveBeenCalledWith('c')
})
it('never displays history returned alongside locked conversation detail', async () => {
 const c = new HistoryController({ detail: async () => ({ id: 'c', locked: true }) as ConversationDetail, read: async () => page([1]), message: String })
 await c.select('c'); expect(c.snapshot().locked).toBe(true); expect(c.snapshot().accessLost).toBe(false); expect(c.snapshot().detail).toBeNull(); expect(c.snapshot().window.messages).toEqual([])
})
it('expires disappearing messages without writing unchanged cache on every clock tick', async () => {
 const cache = { get: vi.fn(async () => null), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
 const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
 try {
  const c = new HistoryController({ detail: async () => ({ id: 'c' }) as ConversationDetail, read: async () => page([1], { results: [{ ...msg(1), expires_at: new Date(now + 1000).toISOString() }] }), message: String, cache })
  await c.select('c'); expect(cache.put).toHaveBeenCalledOnce(); c.expire(); expect(cache.put).toHaveBeenCalledOnce()
  clock.mockReturnValue(now + 1000); c.expire(); expect(c.snapshot().window.messages).toEqual([]); expect(cache.put).toHaveBeenCalledTimes(2)
 } finally { clock.mockRestore() }
})

it('does not let a fast network error mask a concurrent authorization refusal', async () => {
 const { AxiosError } = await import('axios')
 const cache = { get: vi.fn(async () => null), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
 const c = new HistoryController({ detail: async () => { throw new AxiosError('offline') }, read: async () => { await Promise.resolve(); throw { response: { status: 403, data: { code: 'forbidden' } } } }, message: String, cache })
 await c.select('c'); expect(cache.get).not.toHaveBeenCalled(); expect(c.snapshot().accessLost).toBe(true)
})

it('does not hydrate an old unlocked cache when fresh detail is locked but history fails', async () => {
 const { AxiosError } = await import('axios')
 const cache = { get: vi.fn(async () => null), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
 const c = new HistoryController({ detail: async () => ({ id: 'c', locked: true }) as ConversationDetail, read: async () => { throw new AxiosError('offline') }, message: String, cache })
 await c.select('c'); expect(cache.get).not.toHaveBeenCalled(); expect(c.snapshot().locked).toBe(true)
})

it('opens locked history only with the verified ephemeral gate and never caches it', async () => {
 let unlocked = false
 const cache = { get: vi.fn(async () => null), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
 const c = new HistoryController({ detail: async () => ({ id: 'c', locked: true }) as ConversationDetail, read: async () => page([1]), message: String, cache, lockedAccess: () => unlocked })
 await c.select('c'); expect(c.snapshot().locked).toBe(true); expect(c.snapshot().window.messages).toEqual([])
 unlocked = true; c.lockChanged()
 await vi.waitFor(() => expect(c.snapshot().window.messages).toHaveLength(1))
 expect(c.snapshot().locked).toBe(false); expect(c.snapshot().detail?.locked).toBe(true); expect(cache.put).not.toHaveBeenCalled()
 unlocked = false; c.lockChanged(); expect(c.snapshot().locked).toBe(true); expect(c.snapshot().window.messages).toEqual([]); expect(c.snapshot().detail).toBeNull()
})
it('invalidates pending history on background relock and ignores subsequent live messages', async () => {
 let unlocked = true; let release!: (value: MessageWindow) => void
 const read = vi.fn(async () => page([1]))
 const c = new HistoryController({ detail: async () => ({ id: 'c', locked: true }) as ConversationDetail, read, message: String, lockedAccess: () => unlocked })
 await c.select('c'); read.mockImplementationOnce(() => new Promise(resolve => { release = resolve })); const pending = c.latest()
 unlocked = false; c.lockChanged(); release(page([1, 2])); await pending
 c.event({ type: 'MESSAGE_CREATED', data: msg(3) }); expect(c.snapshot().window.messages).toEqual([]); expect(c.snapshot().locked).toBe(true)
})
it('allows newly locked chats to remain open only while the current memory gate is verified', async () => {
 const cache = { get: vi.fn(async () => null), put: vi.fn<HistoryCache['put']>(), remove: vi.fn() }
 const c = new HistoryController({ detail: async () => ({ id: 'c', locked: false }) as ConversationDetail, read: async () => page([1]), message: String, cache, lockedAccess: () => true })
 await c.select('c'); cache.put.mockClear()
 c.event({ type: 'CONVERSATION_SETTINGS', data: { conversation: 'c', locked: true } })
 expect(c.snapshot().window.messages).toHaveLength(1); expect(c.snapshot().detail?.locked).toBe(true); expect(cache.remove).toHaveBeenCalledWith('c'); expect(cache.put).not.toHaveBeenCalled()
})
it('rechecks detail before loading missed history during reconnect', async () => {
 let locked = false
 const read = vi.fn(async () => page([1]))
 const c = new HistoryController({ detail: async () => ({ id: 'c', locked }) as ConversationDetail, read, message: String })
 await c.select('c'); locked = true; c.event({ type: 'RESYNC', data: {} })
 await vi.waitFor(() => expect(c.snapshot().locked).toBe(true))
 expect(read).toHaveBeenCalledOnce(); expect(c.snapshot().window.messages).toEqual([])
})
it('reopens after an authenticated settings event removes the conversation lock', async () => {
 let locked = true
 const c = new HistoryController({ detail: async () => ({ id: 'c', locked }) as ConversationDetail, read: async () => page([1]), message: String })
 await c.select('c'); expect(c.snapshot().locked).toBe(true)
 locked = false; c.event({ type: 'CONVERSATION_SETTINGS', data: { conversation: 'c', locked: false } })
 await vi.waitFor(() => expect(c.snapshot().locked).toBe(false)); await vi.waitFor(() => expect(c.snapshot().window.messages).toHaveLength(1))
})
it('does not repopulate resynced cache with a stale detail response but accepts a fresh detail check', async () => {
 const cache = new ConversationCache({ read: async () => null, write: async () => {}, clear: async () => {} })
 await cache.bind('alice')
 let release!: (detail: ConversationDetail) => void
 const detail = vi.fn(async () => ({ id: 'c', locked: false }) as ConversationDetail)
 detail.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
 const c = new HistoryController({ detail, read: async () => page([1]), message: String, cache })
 const opening = c.select('c'); cache.event({ type: 'RESYNC', data: {} })
 release({ id: 'c', locked: false } as ConversationDetail); await opening
 expect(await cache.get('c')).toBeNull()
 c.accept(msg(2)); expect(await cache.get('c')).toBeNull()
 await c.refreshDetail(); expect((await cache.get('c'))?.window.messages).toHaveLength(2)
 await cache.flush()
})
