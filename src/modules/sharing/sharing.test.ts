import { describe, it, expect, vi } from 'vitest'
import { compatibleSharePlan, makeSharePlan, sharedCaption, shareable, validateIncoming, type IncomingShare } from './model'
import { ShareController, type ShareDependencies } from './controller'
import { mayResolveNative, nativeShareParts } from './nativePayload'
import type { ConversationItem } from '../messenger/api'
const chat = (id: string, locked = false) => ({ id, title: id, locked, can: { send: true, send_file: true } }) as ConversationItem
const file = { name: 'photo.png', size: 42, mime: 'image/png', uri: 'file:///photo.png' }
function harness() {
  let next = 0
  const value: IncomingShare = { id: 'share', owner: 'alice', at: Date.now(), caption: 'Hello', files: [file] }
  const plan = makeSharePlan('Hello', value.files, [chat('one'), chat('two')], () => `id-${++next}`)
  let saved: IncomingShare | null = null
  const deps: ShareDependencies = {
    save: vi.fn(async current => { saved = JSON.parse(JSON.stringify(current)) as IncomingShare }),
    guard: async (_owner, signal, work) => { if (signal.aborted) throw Error('cancelled'); return work() },
    eligible: vi.fn(async () => true), upload: vi.fn(async (_file, key) => ({ id: `upload-${key}` })), send: vi.fn(async () => ({})),
  }
  return { value, plan, deps, saved: () => saved, controller: new ShareController(deps) }
}
describe('incoming share privacy and bounds', () => {
  it('prevents a second tab replacing an already-persisted delivery plan', () => {
    const h = harness()
    expect(compatibleSharePlan(undefined, h.plan)).toBe(true)
    expect(compatibleSharePlan(h.plan, structuredClone(h.plan))).toBe(true)
    expect(compatibleSharePlan(h.plan, { ...h.plan, caption: 'Changed text' })).toBe(false)
    expect(compatibleSharePlan(h.plan, makeSharePlan('Hello', [file], [chat('one')], () => 'different'))).toBe(false)
  })
  it('deduplicates captions without duplicating a contained link', () => expect(sharedCaption(['Title', 'Visit https://a.test', 'https://a.test', 'Title'])).toBe('Title\nVisit https://a.test'))
  it('rejects expired, oversized and empty incoming payloads', () => {
    expect(() => validateIncoming({ at: 0, files: [], caption: 'hi' }, 600001)).toThrow(/expired/)
    expect(() => validateIncoming({ at: Date.now(), files: [{ ...file, size: 51 * 1024 * 1024 }], caption: '' })).toThrow(/50 MB/)
    expect(() => validateIncoming({ at: Date.now(), files: [], caption: '' })).toThrow(/Nothing/)
    expect(() => validateIncoming({ at: Date.now(), files: [], caption: 'x'.repeat(4001) })).toThrow(/4000/)
  })
  it('allows at most five different unlocked destinations with matching file permissions', () => {
    expect(shareable(chat('locked', true), false)).toBe(false)
    expect(() => makeSharePlan('hi', [], Array.from({ length: 6 }, (_, i) => chat(String(i))), () => 'id')).toThrow(/five/)
    expect(() => makeSharePlan('hi', [], [chat('same'), chat('same')], () => 'id')).toThrow(/different/)
    expect(() => makeSharePlan('hi', [file], [{ ...chat('no-files'), can: { ...chat('x').can, send_file: false } }], () => 'id')).toThrow(/cannot/)
  })
  it('never invokes native URL resolution for text, URLs or mixed payloads', () => {
    expect(mayResolveNative([{ shareType: 'url', value: 'https://outside.example/private' }])).toBe(false)
    expect(mayResolveNative([{ shareType: 'image', value: 'content://photo/1' }, { shareType: 'url', value: 'https://outside.example' }])).toBe(false)
    expect(mayResolveNative([{ shareType: 'image', value: 'content://photo/1' }])).toBe(true)
    const inspect = vi.fn(() => ({ name: 'photo', size: 20 }))
    expect(nativeShareParts([{ shareType: 'url', value: 'https://outside.example' }], [], inspect).caption).toBe('https://outside.example')
    expect(inspect).not.toHaveBeenCalled()
    expect(() => nativeShareParts([{ shareType: 'file', value: 'https://outside.example/file' }], [], inspect)).toThrow(/local files/)
  })
})
describe('explicit incoming-share sends', () => {
  it('persists the plan first and uploads a different copy for each destination', async () => {
    const h = harness(); await h.controller.send(h.value, h.plan, () => {})
    expect(h.deps.save).toHaveBeenCalled()
    expect(h.deps.upload).toHaveBeenCalledTimes(2)
    expect(h.plan.jobs[0].uploadKeys[0]).not.toBe(h.plan.jobs[1].uploadKeys[0])
    expect(h.plan.jobs.every(job => job.sent)).toBe(true)
    expect(h.deps.send).toHaveBeenCalledTimes(2)
  })
  it('reuses the same message/upload IDs after an uncertain send response and skips completed chats', async () => {
    const h = harness(); let attempt = 0
    h.deps.send = vi.fn(async conversation => { if (conversation === 'two' && ++attempt === 1) throw Error('lost response'); return {} })
    await expect(h.controller.send(h.value, h.plan, () => {})).rejects.toThrow(/lost response/)
    const persisted = h.saved()!
    expect(persisted.plan!.jobs[0].sent).toBe(true)
    const resumed = new ShareController(h.deps)
    await resumed.send(persisted, persisted.plan!, () => {})
    expect(h.deps.upload).toHaveBeenCalledTimes(2)
    expect(vi.mocked(h.deps.send).mock.calls.map(call => call[0])).toEqual(['one', 'two', 'two'])
    expect(vi.mocked(h.deps.send).mock.calls[1][2]).toBe(vi.mocked(h.deps.send).mock.calls[2][2])
  })
  it('fails closed when durable storage is unavailable before uploading', async () => {
    const h = harness(); h.deps.save = vi.fn(async () => { throw Error('storage unavailable') })
    await expect(h.controller.send(h.value, h.plan, () => {})).rejects.toThrow(/storage/)
    expect(h.deps.upload).not.toHaveBeenCalled(); expect(h.deps.send).not.toHaveBeenCalled()
  })
  it('cancellation stops after an in-flight upload and before sending', async () => {
    const h = harness(); h.deps.upload = vi.fn(async () => { h.controller.cancel(); return { id: 'upload' } })
    await expect(h.controller.send(h.value, h.plan, () => {})).rejects.toThrow(/cancelled/)
    expect(h.deps.send).not.toHaveBeenCalled()
  })
  it('account mismatch and newly locked destinations cannot send', async () => {
    const h = harness(); h.deps.guard = async () => { throw Error('account changed') }
    await expect(h.controller.send(h.value, h.plan, () => {})).rejects.toThrow(/account/)
    expect(h.deps.upload).not.toHaveBeenCalled()
    h.deps.eligible = vi.fn(async () => false)
    await expect(h.controller.send(h.value, h.plan, () => {})).rejects.toThrow(/locked/)
    expect(h.deps.send).not.toHaveBeenCalled()
  })
  it('requires an owner and an explicit attempt; creating a plan does not send', async () => {
    const h = harness(); expect(h.deps.send).not.toHaveBeenCalled()
    await expect(h.controller.send({ ...h.value, owner: null }, h.plan, () => {})).rejects.toThrow(/Sign in/)
  })
})
