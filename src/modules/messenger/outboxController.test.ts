import { afterEach, describe, expect, it, vi } from 'vitest'
import { OutboxController, retryDelay, pendingForConversation, type PendingSend } from './outboxController'
import type { Message, SendPayload } from './api'
const payload={client_id:'same-id',body:'synthetic only',upload_ids:[]}
const msg={id:'sent',conversation:'chat'} as Message
afterEach(() => { vi.useRealTimers() })
const tick=async()=>{for(let n=0;n<50;n++)await Promise.resolve()}
function fixture(saved:PendingSend[]=[]){let rows=saved;const storage={read:vi.fn(async()=>rows),put:vi.fn(async(entry:PendingSend,create:boolean)=>{const index=rows.findIndex(p=>p.owner===entry.owner&&p.payload.client_id===entry.payload.client_id);if(index>=0)rows=rows.map((p,i)=>i===index?entry:p);else if(create)rows=[...rows,entry]}),remove:vi.fn(async(owner:string,client:string)=>{rows=rows.filter(p=>p.owner!==owner||p.payload.client_id!==client)}),clear:vi.fn(async()=>{rows=[]})};const send=vi.fn<(conversation:string,payload:SendPayload,signal:AbortSignal)=>Promise<Message>>(async()=>msg);const delivered=vi.fn();const controller=new OutboxController({storage,send,delivered,network:e=>e==='network',message:String});return{controller,storage,send,delivered}}
describe('account-bound outbox',()=>{
 it('keeps idempotency key on controlled retry and stops immediate retry loops',async()=>{vi.useFakeTimers();const f=fixture();await f.controller.bind('a');f.send.mockRejectedValueOnce('network');f.controller.setActive(true);await f.controller.enqueue('a','chat',payload);await tick();expect(f.controller.snapshot().entries[0].status).toBe('queued');expect(f.send).toHaveBeenCalledTimes(1);await f.controller.flush();expect(f.send).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(1000);expect(f.send.mock.calls[1][1]).toEqual(payload);expect(f.controller.snapshot().entries).toEqual([]);expect(f.delivered).toHaveBeenCalledOnce()})
 it('does not automatically retry server refusal',async()=>{const f=fixture();await f.controller.bind('a');f.send.mockRejectedValueOnce('forbidden');f.controller.setActive(true);await f.controller.enqueue('a','chat',payload);await tick();expect(f.controller.snapshot().entries[0].status).toBe('failed');await f.controller.flush();expect(f.send).toHaveBeenCalledTimes(1);f.controller.retry(payload.client_id);await tick();expect(f.send).toHaveBeenCalledTimes(2)})
 it('isolates owners and clears persisted data on sign-out',async()=>{const f=fixture();await f.controller.bind('a');await f.controller.enqueue('a','chat',payload);await f.controller.bind(null);await tick();expect(f.storage.clear).toHaveBeenCalledOnce();await f.controller.bind('b');expect(f.controller.snapshot().entries).toEqual([]);expect(()=>f.controller.enqueue('a','chat',payload)).toThrow('restoring')})
 it('restores only current owner and interrupted sends after page reload',async()=>{const row={owner:'a',conversation:'chat',payload,created:1,status:'sending' as const};const f=fixture([row,{...row,owner:'b'}]);await f.controller.bind(null,false);await f.controller.bind('a');expect(f.controller.snapshot().entries).toHaveLength(1);expect(f.controller.snapshot().entries[0].status).toBe('queued')})
 it('ignores delayed delivery after account replacement and aborts request',async()=>{const f=fixture();let resolve!:(m:Message)=>void;f.send.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));await f.controller.bind('a');f.controller.setActive(true);await f.controller.enqueue('a','chat',payload);await tick();const signal=f.send.mock.calls[0][2];await f.controller.bind('b');expect(signal.aborted).toBe(true);resolve(msg);await tick();expect(f.delivered).not.toHaveBeenCalled();expect(f.controller.snapshot().entries).toEqual([])})
 it('serializes sends and ignores duplicate enqueue',async()=>{const f=fixture();let resolve!:(m:Message)=>void;f.send.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));await f.controller.bind('a');f.controller.setActive(true);await f.controller.enqueue('a','chat',payload);await f.controller.enqueue('a','chat',payload);await f.controller.enqueue('a','chat',{...payload,client_id:'next'});await tick();expect(f.send).toHaveBeenCalledTimes(1);resolve(msg);await tick();expect(f.send).toHaveBeenCalledTimes(2)})
 it('discards queued content without transmitting it',async()=>{const f=fixture();await f.controller.bind('a');await f.controller.enqueue('a','chat',payload);f.controller.discard('same-id');f.controller.setActive(true);await tick();expect(f.send).not.toHaveBeenCalled()})
 it('reports persistence failure without showing an unsaved message as queued',async()=>{const f=fixture();await f.controller.bind('a');f.storage.put.mockRejectedValue(new Error('storage unavailable'));await expect(f.controller.enqueue('a','chat',payload)).rejects.toThrow('storage unavailable');await tick();expect(f.controller.snapshot().notice).toContain('storage could not be synchronized');expect(f.controller.snapshot().entries).toHaveLength(0)})
})
it('restores oldest queued messages before newer messages regardless of storage key ordering',async()=>{
 const row={owner:'a',conversation:'chat',payload,created:2,status:'queued' as const};const f=fixture([row,{...row,created:1,payload:{...payload,client_id:'older'}}]);await f.controller.bind('a');f.controller.setActive(true);await tick();expect(f.send.mock.calls.map(call=>call[1].client_id)).toEqual(['older','same-id'])
})
it('ignores hydration from an account replaced before its stored messages arrive',async()=>{
 const f=fixture();let resolve!:(rows:PendingSend[])=>void;f.storage.read.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));const first=f.controller.bind('a');await tick();await f.controller.bind('b');resolve([{owner:'a',conversation:'chat',payload,created:1,status:'queued'}]);await first;expect(f.controller.snapshot().entries).toEqual([])
})
it('aborts background sends and preserves their id for foreground retry',async()=>{
 const f=fixture();f.send.mockImplementationOnce((_conversation,_payload,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')))));await f.controller.bind('a');f.controller.setActive(true);await f.controller.enqueue('a','chat',payload);await tick();f.controller.setActive(false);await tick();expect(f.controller.snapshot().entries[0].status).toBe('queued');f.controller.setActive(true);await tick();expect(f.send.mock.calls[1][1].client_id).toBe('same-id');expect(f.controller.snapshot().entries).toEqual([])
})

it('requeues a message when backgrounding occurs while persisting its sending state', async () => {
 const f = fixture(); await f.controller.bind('a')
 const original = f.storage.put.getMockImplementation()!
 let release!: () => void
 f.storage.put.mockImplementation(async (entry, create) => {
  if (entry.status === 'sending') await new Promise<void>(resolve => { release = resolve })
  await original(entry, create)
 })
 f.controller.setActive(true); await f.controller.enqueue('a', 'chat', payload); await tick()
 expect(release).toBeTypeOf('function'); f.controller.setActive(false); release(); await tick()
 expect(f.send).not.toHaveBeenCalled(); expect(f.controller.snapshot().entries[0].status).toBe('queued')
 f.storage.put.mockImplementation(original); f.controller.setActive(true); await tick()
 expect(f.send).toHaveBeenCalledOnce(); expect(f.controller.snapshot().entries).toEqual([])
})

it('does not publish a queued bubble or send until durable persistence finishes', async () => {
 const f = fixture(); await f.controller.bind('a'); f.controller.setActive(true)
 const original = f.storage.put.getMockImplementation()!
 let release!: () => void
 f.storage.put.mockImplementation(async (entry, create) => { if (create) await new Promise<void>(resolve => { release = resolve }); await original(entry, create) })
 const first = f.controller.enqueue('a', 'chat', payload)
 const duplicate = f.controller.enqueue('a', 'chat', payload)
 expect(duplicate).toBe(first); await tick()
 expect(f.controller.snapshot().entries).toEqual([]); expect(f.send).not.toHaveBeenCalled()
 release(); await first; await tick()
 expect(f.send).toHaveBeenCalledOnce(); expect(f.storage.put.mock.calls.filter(([, create]) => create)).toHaveLength(1)
})
it('retains queue order across bounded exponential backoff and persists retry metadata', async () => {
 vi.useFakeTimers(); const f = fixture(); await f.controller.bind('a')
 f.send.mockRejectedValueOnce('network').mockRejectedValueOnce('network')
 await f.controller.enqueue('a', 'chat', payload)
 await f.controller.enqueue('a', 'chat', { ...payload, client_id: 'second' })
 f.controller.setActive(true); await tick()
 expect(f.send).toHaveBeenCalledTimes(1)
 expect(f.controller.snapshot().entries[0].attempts).toBe(1)
 await vi.advanceTimersByTimeAsync(999); expect(f.send).toHaveBeenCalledTimes(1)
 await vi.advanceTimersByTimeAsync(1); expect(f.send).toHaveBeenCalledTimes(2)
 expect(f.controller.snapshot().entries[0].attempts).toBe(2)
 await vi.advanceTimersByTimeAsync(1999); expect(f.send).toHaveBeenCalledTimes(2)
 await vi.advanceTimersByTimeAsync(1)
 expect(f.send.mock.calls.map(call => call[1].client_id)).toEqual(['same-id', 'same-id', 'same-id', 'second'])
 expect(f.storage.put.mock.calls.some(([entry]) => entry.attempts === 2 && entry.nextAttemptAt)).toBe(true)
 expect(retryDelay(100)).toBe(60_000)
})
it('cancels retry timers at sign-out and resumes persisted backoff after restoration', async () => {
 vi.useFakeTimers(); const saved: PendingSend = { owner: 'a', conversation: 'chat', payload, created: 1, status: 'queued', attempts: 3, nextAttemptAt: Date.now() + 4000 }
 const f = fixture([saved]); await f.controller.bind('a'); f.controller.setActive(true); await tick()
 await vi.advanceTimersByTimeAsync(3999); expect(f.send).not.toHaveBeenCalled()
 await f.controller.bind(null); await vi.advanceTimersByTimeAsync(60_000); expect(f.send).not.toHaveBeenCalled()
})


it('preserves enqueue order when the device clock moves backwards before pending writes finish', async () => {
 vi.useFakeTimers(); vi.setSystemTime(10_000); const f = fixture(); await f.controller.bind('a')
 const first = f.controller.enqueue('a', 'chat', payload)
 vi.setSystemTime(1_000)
 const second = f.controller.enqueue('a', 'chat', { ...payload, client_id: 'second' })
 await first; await second; f.controller.setActive(true); await tick()
 expect(f.send.mock.calls.map(call => call[1].client_id)).toEqual(['same-id', 'second'])
})
it('keeps restored older sends ahead of new sends after a device clock correction', async () => {
 vi.useFakeTimers(); vi.setSystemTime(1_000)
 const f = fixture([{ owner: 'a', conversation: 'chat', payload, created: 100_000, status: 'queued' }]); await f.controller.bind('a')
 await f.controller.enqueue('a', 'chat', { ...payload, client_id: 'second' }); f.controller.setActive(true); await tick()
 expect(f.send.mock.calls.map(call => call[1].client_id)).toEqual(['same-id', 'second'])
})

it('persists offline media and resumes its upload checkpoint after restart', async () => {
 const f = fixture(); await f.controller.bind('a')
 const media = [{ key: 'photo-key', name: 'photo.jpg', size: 512, mime: 'image/jpeg' }]
 await f.controller.enqueue('a', 'chat', payload, { media })
 expect(f.send).not.toHaveBeenCalled()
 expect((await f.storage.read())[0].media).toEqual(media)
 await f.controller.uploaded(payload.client_id, 'photo-key', 'uploaded-photo')
 const restored = fixture(await f.storage.read()); await restored.controller.bind('a')
 expect(restored.controller.snapshot().entries[0].media?.[0].uploadId).toBe('uploaded-photo')
 restored.controller.setActive(true); await tick()
 expect(restored.send).toHaveBeenCalledOnce()
 expect(restored.send.mock.calls[0][1].client_id).toBe(payload.client_id)
 expect(restored.controller.snapshot().entries).toEqual([])
})
it('hides a pending bubble as soon as its websocket echo is in history', () => {
 const entry: PendingSend = { owner: 'a', conversation: 'chat', payload, created: 1, status: 'sending' }
 expect(pendingForConversation([entry], 'chat', [{ client_id: payload.client_id }])).toEqual([])
 expect(pendingForConversation([entry], 'chat', [{ client_id: null }])).toEqual([entry])
 expect(pendingForConversation([entry], 'another-chat', [])).toEqual([])
})
it('does not persist every upload progress tick', async () => {
 const f = fixture(); await f.controller.bind('a'); await f.controller.enqueue('a', 'chat', payload)
 const before = f.storage.put.mock.calls.length
 f.controller.progress(payload.client_id, 0.51); f.controller.progress(payload.client_id, 0.511)
 expect(f.controller.snapshot().entries[0].progress).toBe(0.51)
 expect(f.storage.put).toHaveBeenCalledTimes(before)
})
