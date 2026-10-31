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
