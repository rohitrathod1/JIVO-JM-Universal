import { expect, it, vi } from 'vitest'
import { PushController, type PushDependencies } from './pushController'

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
function setup(overrides: Partial<PushDependencies> = {}) {
  const flags = new Set<string>(); const calls: string[] = []
  const deps: PushDependencies = {
    support: () => 'supported', permission: () => 'granted', requestPermission: vi.fn(async () => 'granted'),
    wants: owner => flags.has(owner), remember: (owner, on) => { if (on) flags.add(owner); else flags.delete(owner) },
    lock: work => work(), prepare: async owner => { calls.push('prepare:' + owner) },
    connect: async owner => { calls.push('connect:' + owner) }, disconnect: async owner => { calls.push('disconnect:' + owner) },
    test: async () => 1, message: error => error instanceof Error ? error.message : 'Failed', ...overrides,
  }
  return { model: new PushController(deps), deps, flags, calls }
}
it('never requests permission during automatic ready sync', async () => {
  const f = setup(); await f.model.bind('alice'); await f.model.sync()
  expect(f.deps.requestPermission).not.toHaveBeenCalled(); expect(f.calls).toEqual(['prepare:alice'])
})
it('restores only the current account’s remembered choice without a permission prompt', async () => {
  const f = setup(); f.flags.add('alice'); await f.model.bind('bob'); await f.model.sync()
  expect(f.calls).not.toContain('connect:bob')
  await f.model.bind('alice'); await f.model.sync()
  expect(f.model.snapshot().enabled).toBe(true); expect(f.calls).toContain('connect:alice'); expect(f.deps.requestPermission).not.toHaveBeenCalled()
})
it('requests permission synchronously from Enable and remembers only a successful registration', async () => {
  const f = setup(); await f.model.bind('alice'); const enabled = f.model.enable()
  expect(f.deps.requestPermission).toHaveBeenCalledOnce(); await enabled
  expect(f.flags.has('alice')).toBe(true); expect(f.model.snapshot()).toMatchObject({ enabled: true, busy: false, error: null })
})
it('does not register an old account after its permission prompt finishes late', async () => {
  const permission = deferred<string>(); const f = setup({ requestPermission: () => permission.promise })
  await f.model.bind('alice'); const enabled = f.model.enable(); await f.model.bind('bob'); permission.resolve('granted'); await enabled
  expect(f.calls).not.toContain('connect:alice'); expect(f.flags.size).toBe(0); expect(f.model.snapshot().owner).toBe('bob')
})
it('cleans a late registration before preparing the next account', async () => {
  const connection = deferred<void>(); const f = setup({ connect: async owner => { f.calls.push('connect:' + owner); await connection.promise } })
  await f.model.bind('alice'); const enabled = f.model.enable()
  await vi.waitFor(() => expect(f.calls).toContain('connect:alice'))
  const next = f.model.bind('bob'); expect(f.model.snapshot().owner).toBe('bob')
  connection.resolve(); await Promise.all([enabled, next])
  expect(f.flags.has('alice')).toBe(false)
  expect(f.calls.indexOf('disconnect:alice')).toBeLessThan(f.calls.indexOf('prepare:bob'))
  expect(f.calls).not.toContain('disconnect:bob')
})
it('Disable cancels a pending Enable and removes only that account’s preference', async () => {
  const permission = deferred<string>(); const f = setup({ requestPermission: () => permission.promise }); f.flags.add('alice'); f.flags.add('bob')
  await f.model.bind('alice'); const pending = f.model.enable(); await f.model.disable(); permission.resolve('granted'); await pending
  expect(f.flags.has('alice')).toBe(false); expect(f.flags.has('bob')).toBe(true); expect(f.model.snapshot().enabled).toBe(false)
})
it('reports permission refusal and server setup failures without marking push enabled', async () => {
  const denied = setup({ requestPermission: async () => 'denied' }); await denied.model.bind('alice'); await denied.model.enable()
  expect(denied.model.snapshot().error).toContain('not enabled'); expect(denied.flags.size).toBe(0)
  const unavailable = setup({ connect: async () => { throw Error('Server not configured') } }); await unavailable.model.bind('alice'); await unavailable.model.enable()
  expect(unavailable.model.snapshot()).toMatchObject({ enabled: false, busy: false, error: 'Server not configured' })
})
it('sign-out invalidates pending work immediately and preserves the person’s opt-in for their next sign-in', async () => {
  const f = setup(); f.flags.add('alice'); await f.model.bind('alice'); await f.model.sync(); const cleanup = f.model.bind(null)
  expect(f.model.snapshot()).toMatchObject({ owner: null, enabled: false }); await cleanup
  expect(f.flags.has('alice')).toBe(true); expect(f.calls).toContain('disconnect:alice')
})
it('does not test-send after the account changed while waiting for the shared lock', async () => {
  const gate = deferred<void>(); const test = vi.fn(async () => 1); const f = setup({ test }); f.flags.add('alice')
  await f.model.bind('alice'); await f.model.sync(); f.deps.lock = async work => { await gate.promise; return work() }
  const pending = f.model.test(); const logout = f.model.bind(null); gate.resolve(); await Promise.all([pending, logout])
  expect(test).not.toHaveBeenCalled()
})
