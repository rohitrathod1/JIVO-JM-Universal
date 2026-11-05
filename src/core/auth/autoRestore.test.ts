import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreDelay, watchUnreachable } from './autoRestore'

function lifecycle(initial: boolean) {
  let handler: ((active: boolean) => void) | null = null
  const off = vi.fn(() => { handler = null })
  return { off, emit: (active: boolean) => handler?.(active), subscribe: (h: (active: boolean) => void) => { handler = h; h(initial); return off } }
}

describe('watchUnreachable (OFF-01)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('restores immediately when a cold-start-offline device comes back online, once', () => {
    const life = lifecycle(false); const restore = vi.fn()
    watchUnreachable({ subscribe: life.subscribe, restore, attempts: 0 })
    expect(restore).not.toHaveBeenCalled()
    life.emit(true); life.emit(false); life.emit(true)
    expect(restore).toHaveBeenCalledTimes(1); expect(restore).toHaveBeenCalledWith('online')
    expect(life.off).toHaveBeenCalled()
    vi.advanceTimersByTime(60_000); expect(restore).toHaveBeenCalledTimes(1)
  })

  it('does not treat the initial online report as a transition but retries on backoff (server down)', () => {
    const life = lifecycle(true); const restore = vi.fn()
    watchUnreachable({ subscribe: life.subscribe, restore, attempts: 1 })
    vi.advanceTimersByTime(5_999); expect(restore).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(restore).toHaveBeenCalledWith('timer')
  })

  it('waits for connectivity instead of spinning while offline', () => {
    const life = lifecycle(false); const restore = vi.fn()
    watchUnreachable({ subscribe: life.subscribe, restore, attempts: 0 })
    vi.advanceTimersByTime(120_000); expect(restore).not.toHaveBeenCalled()
    life.emit(true); expect(restore).toHaveBeenCalledTimes(1)
  })

  it('restores when the app returns to the foreground', () => {
    const life = lifecycle(true); const restore = vi.fn()
    watchUnreachable({ subscribe: life.subscribe, restore, attempts: 4 })
    life.emit(false); life.emit(true)
    expect(restore).toHaveBeenCalledWith('online')
  })

  it('stops cleanly when disposed', () => {
    const life = lifecycle(false); const restore = vi.fn()
    const stop = watchUnreachable({ subscribe: life.subscribe, restore, attempts: 0 })
    stop(); life.emit(true); vi.advanceTimersByTime(60_000)
    expect(restore).not.toHaveBeenCalled(); expect(life.off).toHaveBeenCalledTimes(1)
  })

  it('caps the backoff at 30 seconds', () => {
    expect([0, 1, 2, 3, 4, 9].map(restoreDelay)).toEqual([3_000, 6_000, 12_000, 24_000, 30_000, 30_000])
  })
})
