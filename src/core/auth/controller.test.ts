import { describe, expect, it, vi } from 'vitest'
import { SessionController, type SessionDependencies } from './controller'
import type { Me } from './types'
const me = { id: 'test-user', name: 'Test User' } as Me
function setup(overrides: Partial<SessionDependencies> = {}) {
  const deps = { enabled: true, csrf: vi.fn(async () => {}), me: vi.fn(async () => me),
    login: vi.fn(async () => ({ status: 'ok' as const })), logout: vi.fn(async () => {}),
    clear: vi.fn(async () => {}), unauthorized: (e: unknown) => e === '401', message: String, ...overrides }
  return { controller: new SessionController(deps), deps }
}
describe('session lifecycle', () => {
  it('does not contact the server when no origin is configured', async () => {
    const { controller, deps } = setup({ enabled: false }); await controller.restore()
    expect(controller.snapshot().status).toBe('anonymous'); expect(deps.csrf).not.toHaveBeenCalled()
  })
  it('restores the existing server session', async () => {
    const { controller } = setup(); await controller.restore()
    expect(controller.snapshot()).toEqual({ status: 'ready', me })
  })
  it('distinguishes an expired session from an unreachable server', async () => {
    const { controller } = setup({ me: async () => { throw '401' } }); await controller.restore()
    expect(controller.snapshot().status).toBe('anonymous')
    const other = setup({ me: async () => { throw new Error('offline') } }); await other.controller.restore()
    expect(other.controller.snapshot().status).toBe('unreachable')
  })
  it('does not adopt an outstanding me response after logout', async () => {
    let resolve!: (value: Me) => void
    const { controller } = setup({ me: () => new Promise(r => { resolve = r }) })
    const pending = controller.restore(); await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    await controller.logout(); resolve(me); await pending
    expect(controller.snapshot()).toEqual({ status: 'anonymous', me: null })
  })
  it('retains MFA as a challenge instead of treating password success as authenticated', async () => {
    const { controller, deps } = setup({ login: async () => ({ status: 'mfa_required', mfa_token: 'test-only', methods: ['recovery_code'] }) })
    expect((await controller.login('x', 'x')).status).toBe('mfa_required')
    expect(deps.me).not.toHaveBeenCalled(); expect(controller.snapshot().me).toBeNull()
  })
  it('clears native cookies even when server logout fails, while reporting failure', async () => {
    const { controller, deps } = setup({ logout: async () => { throw new Error('offline') } })
    await controller.restore()
    await expect(controller.logout()).rejects.toThrow('offline')
    expect(controller.snapshot().me).toBeNull(); expect(deps.clear).toHaveBeenCalledOnce()
  })
})

it('serializes new login behind logout and cookie cleanup even when logout fails', async () => {
  let rejectLogout!: (error: Error) => void
  let finishCleanup!: () => void
  const logout = vi.fn(() => new Promise<void>((_, reject) => { rejectLogout = reject }))
  const clear = vi.fn(() => new Promise<void>(resolve => { finishCleanup = resolve }))
  const login = vi.fn(async () => ({ status: 'ok' as const }))
  const { controller } = setup({ logout, clear, login })
  await controller.restore()
  const leaving = controller.logout()
  const assertion = expect(leaving).rejects.toThrow('network failed')
  const arriving = controller.login('new@example.invalid', 'mock-only')
  expect(controller.snapshot().status).toBe('signing-out')
  expect(login).not.toHaveBeenCalled()
  rejectLogout(new Error('network failed'))
  await vi.waitFor(() => expect(clear).toHaveBeenCalledOnce())
  expect(login).not.toHaveBeenCalled()
  finishCleanup(); await assertion; await arriving
  expect(login).toHaveBeenCalledOnce()
  expect(controller.snapshot()).toEqual({ status: 'ready', me })
})

it('preserves outbox storage only during session restoration, never login/logout boundaries',async()=>{
 const boundary=vi.fn();const {controller}=setup({boundary});await controller.restore();expect(boundary).toHaveBeenLastCalledWith(true);await controller.login('synthetic@example.invalid','mock-only');expect(boundary).toHaveBeenLastCalledWith(false);await controller.logout();expect(boundary).toHaveBeenLastCalledWith(false)
})
