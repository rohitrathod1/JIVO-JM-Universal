import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RealtimeClient, type Socket } from './client'
function setup() {
  const sockets: Socket[] = []
  const make = vi.fn(() => {
    const socket: Socket = { readyState: 1, send: vi.fn(), close: vi.fn(), onopen: null, onmessage: null, onclose: null, onerror: null }
    sockets.push(socket); return socket
  })
  const revoked = vi.fn()
  return { client: new RealtimeClient('wss://test.example.invalid/ws/', make, revoked), sockets, make, revoked }
}
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
describe('realtime lifecycle', () => {
  it('opens only one connection, sends focus and heartbeats, and cleans up on stop', () => {
    const { client, sockets, make } = setup(); client.start(); client.start()
    expect(make).toHaveBeenCalledOnce()
    sockets[0].onopen?.(); client.setFocusedConversation('conversation')
    expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({ type: 'CLIENT_STATE', data: { visible: true, focused_conversation: 'conversation' } }))
    vi.advanceTimersByTime(25000); expect(sockets[0].send).toHaveBeenCalledWith('{"type":"PING","data":{}}')
    client.stop(); vi.advanceTimersByTime(120000); expect(make).toHaveBeenCalledOnce(); expect(sockets[0].close).toHaveBeenCalled()
  })
  it('reconnects with resync after foreground return', () => {
    const { client, sockets } = setup(); const resync = vi.fn(); client.on('RESYNC', resync)
    client.start(); sockets[0].onmessage?.({ data: '{"type":"HELLO","data":{}}' })
    client.setActive(false); vi.advanceTimersByTime(120000); expect(sockets).toHaveLength(1)
    client.setActive(true); sockets[1].onmessage?.({ data: '{"type":"HELLO","data":{}}' })
    expect(resync).toHaveBeenCalledOnce(); client.stop()
  })
  it('stops permanently on revoked sessions', () => {
    const { client, sockets, revoked } = setup(); client.start(); sockets[0].onclose?.({ code: 4401 })
    vi.advanceTimersByTime(120000); expect(sockets).toHaveLength(1); expect(revoked).toHaveBeenCalledOnce()
  })
  it('backs off and stops pending reconnect timers on logout', () => {
    const { client, sockets } = setup(); client.start(); sockets[0].onclose?.({ code: 1006 })
    vi.advanceTimersByTime(999); expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1); expect(sockets).toHaveLength(2)
    sockets[1].onclose?.({ code: 1006 }); client.stop(); vi.advanceTimersByTime(10000)
    expect(sockets).toHaveLength(2)
  })
})
