import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { actionFailure, OFFLINE_ACTION } from './offlineAction'

const message = (error: unknown) => error instanceof Error ? error.message : 'other'
describe('message action failures (OFF-05)', () => {
  it('says the device is offline when the request never reached the server', () => {
    expect(actionFailure(new AxiosError('Network Error', 'ERR_NETWORK'), message, () => false)).toBe(OFFLINE_ACTION)
    expect(actionFailure(Error('anything'), message, () => true)).toBe(OFFLINE_ACTION)
  })
  it("keeps the server's message for a refusal while online", () => {
    const refused = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, { status: 403, data: {}, statusText: '', headers: {}, config: {} as never })
    expect(actionFailure(refused, () => 'You cannot react here.', () => false)).toBe('You cannot react here.')
  })
})
