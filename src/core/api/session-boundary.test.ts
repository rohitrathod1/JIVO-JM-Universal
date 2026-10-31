import { expect, it, vi } from 'vitest'
import { createTransport } from './transport'
import { AxiosError, AxiosHeaders } from 'axios'
it('does not send a mutation whose CSRF lookup finishes after a session boundary', async () => {
  let resolve!: (value: string) => void
  const transport = createTransport({ origin: 'https://example.invalid', native: false, csrf: () => new Promise(r => { resolve = r }), lost: vi.fn() })
  const adapter = vi.fn(async config => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config })); transport.api.defaults.adapter = adapter
  const request = transport.api.post('/me/', {}); const assertion = expect(request).rejects.toThrow('previous session')
  await vi.waitFor(() => expect(resolve).toBeDefined()); transport.advanceSession(); resolve('csrf'); await assertion; expect(adapter).not.toHaveBeenCalled()
})
it('does not replay a verified action into a different session', async () => {
  let resolve!: (value: boolean) => void
  const handler = vi.fn(() => new Promise<boolean>(r => { resolve = r }))
  const transport = createTransport({ origin: 'https://example.invalid', native: false, csrf: async () => 'csrf', lost: vi.fn() }); transport.onStepUpRequired(handler)
  const adapter = vi.fn(async config => { throw new AxiosError('Step up', 'ERR_BAD_REQUEST', config, undefined, { data: { code: 'step_up_required', methods: ['password'] }, status: 403, statusText: 'Forbidden', headers: new AxiosHeaders(), config }) }); transport.api.defaults.adapter = adapter
  const request = transport.api.post('/me/', {}); const assertion = expect(request).rejects.toThrow('Step up')
  await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce()); transport.advanceSession(); resolve(true); await assertion; expect(adapter).toHaveBeenCalledOnce()
})
