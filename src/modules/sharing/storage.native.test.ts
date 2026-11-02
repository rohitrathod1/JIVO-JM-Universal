import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharePayload } from 'expo-sharing'
import type { IncomingShare } from './model'
import { SHARE_TTL } from './model'

const fixture = vi.hoisted(() => ({
  raw: [] as SharePayload[], stored: null as string | null,
  resolve: vi.fn(async () => []), clear: vi.fn(),
  digest: vi.fn(async (_algorithm: string, value: string) => `hash:${value}`),
  read: vi.fn<() => Promise<string | null>>(),
}))
vi.mock('expo-sharing', () => ({
  getSharedPayloads: () => fixture.raw,
  clearSharedPayloads: () => { fixture.clear(); fixture.raw = [] },
  getResolvedSharedPayloadsAsync: fixture.resolve,
}))
vi.mock('expo-crypto', () => ({ randomUUID: () => 'version', CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: fixture.digest }))
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'unlocked', getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }))
vi.mock('expo-file-system', () => ({ File: class { size = 10; name = 'original.png' } }))
vi.mock('../../core/storage/secureSnapshot', () => ({ SecureSnapshot: class {
  read = fixture.read
  async write(value: string) { fixture.stored = value }
  async clear() { fixture.stored = null }
} }))

const raw = (value: string): SharePayload[] => [{ shareType: 'text', value }]
const id = (payload: SharePayload[]) => `hash:${JSON.stringify(payload)}`
const partial = (): IncomingShare => ({
  id: id(raw('first')), owner: 'alice', at: Date.now(), caption: 'first',
  files: [{ uri: 'content://original/1', name: 'original.png', size: 10, mime: 'image/png' }],
  plan: { caption: 'first', jobs: [
    { conversation: 'one', title: 'One', clientId: 'stable-one', uploadKeys: ['upload-one'], uploadIds: ['uploaded-one'], sent: true },
    { conversation: 'two', title: 'Two', clientId: 'stable-two', uploadKeys: ['upload-two'], uploadIds: ['uploaded-two'], sent: false },
  ] },
})
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks()
  fixture.raw = []; fixture.stored = null
  fixture.read.mockImplementation(async () => fixture.stored)
  fixture.digest.mockImplementation(async (_algorithm, value) => `hash:${value}`)
})

describe('native incoming share slot and durable retry plan', () => {
  it('preserves a partially sent plan when another ACTION_SEND replaces the OS payload', async () => {
    const previous = partial(); fixture.stored = JSON.stringify(previous); fixture.raw = raw('second')
    const { incomingStorage } = await import('./storage.native')
    expect(await incomingStorage.read('alice')).toEqual(previous)
    expect(JSON.parse(fixture.stored!)).toEqual(previous)
    expect(fixture.resolve).not.toHaveBeenCalled(); expect(fixture.clear).not.toHaveBeenCalled()
    await incomingStorage.clear(previous.id)
    expect(fixture.raw).toEqual(raw('second'))
    expect(await incomingStorage.read('alice')).toMatchObject({ id: id(raw('second')), caption: 'second', owner: 'alice' })
  })
  it('restores a durable plan after restart even when Expo has no pending payload', async () => {
    const previous = partial(); fixture.stored = JSON.stringify(previous)
    const { incomingStorage } = await import('./storage.native')
    expect(await incomingStorage.hasPending()).toBe(true)
    expect(await incomingStorage.read('alice')).toEqual(previous)
  })
  it('accepts the newer intent after the previous review expires without renewing the old plan', async () => {
    const previous = { ...partial(), at: Date.now() - SHARE_TTL - 1 }
    fixture.stored = JSON.stringify(previous); fixture.raw = raw('second')
    const { incomingStorage } = await import('./storage.native')
    const current = await incomingStorage.read('alice')
    expect(current).toMatchObject({ id: id(raw('second')), caption: 'second' }); expect(current?.plan).toBeUndefined()
  })
  it('clears an expired same intent rather than granting it a fresh lifetime', async () => {
    fixture.stored = JSON.stringify({ ...partial(), at: Date.now() - SHARE_TTL - 1 }); fixture.raw = raw('first')
    const { incomingStorage } = await import('./storage.native')
    expect(await incomingStorage.read('alice')).toBeNull()
    expect(fixture.stored).toBeNull(); expect(fixture.raw).toEqual([])
  })
  it('discards both the protected review and raw intent when the account differs', async () => {
    fixture.stored = JSON.stringify(partial()); fixture.raw = raw('second')
    const { incomingStorage } = await import('./storage.native')
    expect(await incomingStorage.read('bob')).toBeNull()
    expect(fixture.stored).toBeNull(); expect(fixture.raw).toEqual([])
  })
  it('does not erase a newer intent arriving while a matching discard is being hashed', async () => {
    const previous = partial(); fixture.stored = JSON.stringify(previous); fixture.raw = raw('first')
    fixture.digest.mockImplementation(async (_algorithm, value) => { fixture.raw = raw('second'); return `hash:${value}` })
    const { incomingStorage } = await import('./storage.native')
    await incomingStorage.clear(previous.id)
    expect(fixture.stored).toBeNull(); expect(fixture.raw).toEqual(raw('second')); expect(fixture.clear).not.toHaveBeenCalled()
  })
  it('rejects an old save after explicit account-boundary clearing', async () => {
    const previous = partial(); fixture.stored = JSON.stringify(previous); fixture.raw = raw('second')
    const { incomingStorage } = await import('./storage.native')
    await incomingStorage.clear()
    await expect(incomingStorage.save(previous)).rejects.toThrow(/previous session/)
    expect(await incomingStorage.hasPending()).toBe(false)
  })
  it('does not remove a new stored review when an obsolete screen discards its old ID', async () => {
    const current = { ...partial(), id: id(raw('second')), caption: 'second', plan: undefined }
    fixture.stored = JSON.stringify(current); fixture.raw = raw('second')
    const { incomingStorage } = await import('./storage.native')
    await incomingStorage.clear(id(raw('first')))
    expect(JSON.parse(fixture.stored!)).toEqual(current); expect(fixture.raw).toEqual(raw('second'))
  })
})
