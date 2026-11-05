import { afterEach, expect, it, vi } from 'vitest'
import { ChatLockController, CHAT_LOCK_BACKGROUND_MS } from './chatLockController'
import type { ConversationDetail } from './api'

const controllers: ChatLockController[] = []
afterEach(() => { controllers.forEach(model => model.bind(null)); controllers.length = 0; vi.useRealTimers() })
function setup() {
  let now = 0
  const deps = { verify: vi.fn(async (_signal: AbortSignal) => {}), update: vi.fn(async (id: string, locked: boolean, _signal: AbortSignal) => ({ id, locked }) as ConversationDetail), message: String, now: () => now }
  const model = new ChatLockController(deps); controllers.push(model)
  return { model, deps, advance: (ms: number) => { now += ms } }
}
it('starts closed and unlocks only after the server-authorized locked-list request', async () => {
  const { model, deps } = setup(); expect(model.snapshot().unlocked).toBe(false)
  expect(await model.unlock()).toBe(false); expect(deps.verify).not.toHaveBeenCalled()
  model.bind('alice'); expect(await model.unlock()).toBe(true); expect(deps.verify).toHaveBeenCalledOnce(); expect(model.snapshot().unlocked).toBe(true)
  expect(await model.unlock()).toBe(true); expect(deps.verify).toHaveBeenCalledOnce()
})
it('does not open on server rejection or cancelled identity confirmation', async () => {
  const { model, deps } = setup(); model.bind('alice'); deps.verify.mockRejectedValue(Error('Identity verification is required.'))
  expect(await model.unlock()).toBe(false); expect(model.snapshot()).toEqual({ unlocked: false, busy: false, error: 'Error: Identity verification is required.' })
})
it('deduplicates overlapping unlock actions and exposes busy until the confirmation resolves', async () => {
  const { model, deps } = setup(); model.bind('alice')
  let release!: () => void; deps.verify.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const pending = model.unlock(); expect(model.snapshot().busy).toBe(true); expect(await model.unlock()).toBe(false)
  release(); expect(await pending).toBe(true); expect(deps.verify).toHaveBeenCalledOnce()
})
it('rejects late authorization from a previous owner even if the transport ignores abort', async () => {
  const { model, deps } = setup(); model.bind('alice')
  let release!: () => void; deps.verify.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const pending = model.unlock(); const signal = deps.verify.mock.calls[0][0]; model.bind('bob')
  expect(signal.aborted).toBe(true); release(); expect(await pending).toBe(false); expect(model.snapshot().unlocked).toBe(false)
})
it('clears the ephemeral grant at sign-out and does not restore it for the same owner', async () => {
  const { model } = setup(); model.bind('alice'); await model.unlock(); model.bind(null); model.bind('alice')
  expect(model.snapshot().unlocked).toBe(false)
})
it('retains access through a short background but relocks at the exact five-minute boundary', async () => {
  const { model, advance } = setup(); model.bind('alice'); await model.unlock()
  model.visibility(false); advance(CHAT_LOCK_BACKGROUND_MS - 1); model.visibility(true); expect(model.snapshot().unlocked).toBe(true)
  model.visibility(false); advance(CHAT_LOCK_BACKGROUND_MS); model.visibility(true); expect(model.snapshot().unlocked).toBe(false)
})
it('does not restart the background clock on duplicate native events', async () => {
  const { model, advance } = setup(); model.bind('alice'); await model.unlock()
  model.visibility(false); advance(CHAT_LOCK_BACKGROUND_MS - 1); model.visibility(false); advance(1); model.visibility(true)
  expect(model.snapshot().unlocked).toBe(false)
})
it('also removes displayed content while a background timer is allowed to run', async () => {
  vi.useFakeTimers(); const { model } = setup(); model.bind('alice'); await model.unlock(); model.visibility(false)
  await vi.advanceTimersByTimeAsync(CHAT_LOCK_BACKGROUND_MS); expect(model.snapshot().unlocked).toBe(false)
})
it('cancels an identity attempt when backgrounded and ignores a late successful result', async () => {
  const { model, deps } = setup(); model.bind('alice')
  let release!: () => void; deps.verify.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const pending = model.unlock(); model.visibility(false); model.visibility(true); release()
  expect(await pending).toBe(false); expect(model.snapshot().unlocked).toBe(false); expect(deps.verify.mock.calls[0][0].aborted).toBe(true)
})
it('opens no identity request while hidden and relocks if the device clock moves backwards', async () => {
  const { model, deps, advance } = setup(); model.bind('alice'); model.visibility(false); expect(await model.unlock()).toBe(false); expect(deps.verify).not.toHaveBeenCalled()
  model.visibility(true); await model.unlock(); advance(100); model.visibility(false); advance(-200); model.visibility(true); expect(model.snapshot().unlocked).toBe(false)
})
it('updates lock/unlock settings through the backend and opens the current in-memory gate', async () => {
  const { model, deps } = setup(); model.bind('alice')
  expect(await model.setLocked('c', true)).toMatchObject({ id: 'c', locked: true }); expect(model.snapshot().unlocked).toBe(true)
  expect(await model.setLocked('c', false)).toMatchObject({ id: 'c', locked: false }); expect(deps.update.mock.calls.map(call => call.slice(0, 2))).toEqual([['c', true], ['c', false]])
})
it('does not show a late settings mutation result after explicit relock', async () => {
  const { model, deps } = setup(); model.bind('alice')
  let release!: (value: ConversationDetail) => void; deps.update.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const pending = model.setLocked('c', true); model.relock(); release({ id: 'c', locked: true } as ConversationDetail)
  expect(await pending).toBeNull(); expect(model.snapshot().unlocked).toBe(false)
})
