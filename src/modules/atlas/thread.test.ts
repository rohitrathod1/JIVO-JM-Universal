import { describe, expect, it, vi } from 'vitest'
import { AtlasThread, type Clock, type ThreadApi } from './thread'
import type { Ask, AskPage } from './model'

const T0 = Date.parse('2026-11-05T10:00:00Z')
const ask = (id: number, patch: Partial<Ask> = {}): Ask => ({ id, text: `Question ${id}`, state: 'queued', answer: null, with: null, error_message: null, reply_to: null, created_at: new Date(T0).toISOString(), answered_at: null, open: true, ...patch })
const axiosError = (status: number | null, data: unknown = {}) => ({ isAxiosError: true, message: 'x', response: status === null ? undefined : { status, data } })
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

/** A manual clock: `advance` runs due timers in order. */
function fakeClock() {
  let now = T0; let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const clock: Clock = { now: () => now, set: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id }, clear: id => { timers.delete(id as number) } }
  return {
    clock, pending: () => [...timers.values()].map(t => t.at - now).sort((a, b) => a - b),
    async advance(ms: number) {
      const end = now + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0]); now = due[1].at; due[1].fn(); await flush()
      }
      now = end
    },
  }
}

function fakeApi(page: AskPage = { results: [], has_more: false }) {
  return { list: vi.fn<ThreadApi['list']>(async () => page), create: vi.fn<ThreadApi['create']>(), get: vi.fn<ThreadApi['get']>() }
}

describe('AtlasThread', () => {
  it('starts from the cache, then loads the first page when active', async () => {
    const api = fakeApi({ results: [ask(5, { state: 'done', open: false })], has_more: true })
    const { clock } = fakeClock()
    const saved: number[][] = []
    const thread = new AtlasThread(api, clock, { asks: [ask(4, { state: 'done', open: false })], hasMore: false }, value => saved.push(value.asks.map(a => a.id)))
    expect(thread.snapshot().asks.map(a => a.id)).toEqual([4])
    expect(api.list).not.toHaveBeenCalled()
    thread.setActive(true); await flush()
    expect(thread.snapshot()).toMatchObject({ loaded: true, hasMore: true })
    expect(thread.snapshot().asks.map(a => a.id)).toEqual([5])
    expect(saved.at(-1)).toEqual([5])
  })

  it('keeps cached asks and says so when the first page cannot load', async () => {
    const api = fakeApi(); api.list.mockRejectedValue(axiosError(null))
    const thread = new AtlasThread(api, fakeClock().clock, { asks: [ask(2, { state: 'done', open: false })], hasMore: false })
    thread.setActive(true); await flush()
    expect(thread.snapshot().asks.map(a => a.id)).toEqual([2])
    expect(thread.snapshot().error).toMatch(/Cannot reach JM/)
  })

  it('polls an open ask every 2 s, slows after 3 min, and stops when done', async () => {
    const api = fakeApi({ results: [ask(1)], has_more: false })
    const time = fakeClock()
    let state: Ask = ask(1, { state: 'working' })
    api.get.mockImplementation(async () => state)
    const thread = new AtlasThread(api, time.clock)
    thread.setActive(true); await flush()
    expect(time.pending()).toEqual([2_000])
    await time.advance(2_000)
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(thread.snapshot().asks[0].state).toBe('working')
    await time.advance(178_000) // now 3 min after creation
    expect(api.get).toHaveBeenCalledTimes(90) // every 2 s up to 3 min
    expect(time.pending()).toEqual([30_000])
    await time.advance(30_000)
    expect(api.get).toHaveBeenCalledTimes(91)
    state = ask(1, { state: 'done', answer: '42', open: false })
    await time.advance(30_000)
    expect(thread.snapshot().asks[0]).toMatchObject({ state: 'done', answer: '42' })
    expect(time.pending()).toEqual([])
  })

  it('with_person polls every 30 s from the start', async () => {
    const api = fakeApi({ results: [ask(1, { state: 'with_person', with: 'Accounts' })], has_more: false })
    const time = fakeClock()
    const thread = new AtlasThread(api, time.clock)
    thread.setActive(true); await flush()
    expect(time.pending()).toEqual([30_000])
  })

  it('pauses polling while inactive and reloads when active again', async () => {
    const api = fakeApi({ results: [ask(1)], has_more: false })
    const time = fakeClock()
    const thread = new AtlasThread(api, time.clock)
    thread.setActive(true); await flush()
    thread.setActive(false)
    expect(time.pending()).toEqual([])
    thread.setActive(true); await flush()
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(time.pending()).toEqual([2_000])
  })

  it('backs off to 30 s when a poll fails', async () => {
    const api = fakeApi({ results: [ask(1)], has_more: false }); api.get.mockRejectedValue(axiosError(502))
    const time = fakeClock()
    const thread = new AtlasThread(api, time.clock)
    thread.setActive(true); await flush()
    await time.advance(2_000)
    expect(time.pending()).toEqual([30_000])
  })

  it('a taken ask is added and polled; the caller clears its draft', async () => {
    const api = fakeApi()
    api.create.mockResolvedValue(ask(9, { reply_to: 4 }))
    const time = fakeClock()
    const thread = new AtlasThread(api, time.clock)
    thread.setActive(true); await flush()
    await expect(thread.send('How much stock?', 4)).resolves.toBe(true)
    expect(api.create).toHaveBeenCalledWith('How much stock?', 4)
    expect(thread.snapshot().asks[0]).toMatchObject({ id: 9, reply_to: 4 })
    expect(time.pending()).toEqual([2_000])
  })

  it('503 keeps the draft and offers Retry; 429 records when to retry', async () => {
    const api = fakeApi()
    const time = fakeClock()
    const thread = new AtlasThread(api, time.clock)
    api.create.mockRejectedValueOnce(axiosError(503, { detail: 'Atlas is unavailable.' }))
    await expect(thread.send('Q', null)).resolves.toBe(false)
    expect(thread.snapshot()).toMatchObject({ sending: false, sendError: { kind: 'unavailable', retryable: true }, retryAt: null })
    api.create.mockRejectedValueOnce(axiosError(429, { detail: 'Too many.', retry_after: 20 }))
    await thread.send('Q', null)
    expect(thread.snapshot().retryAt).toBe(T0 + 20_000)
    thread.clearSendError()
    expect(thread.snapshot().sendError).toBeNull()
  })

  it('Retry on a failed ask sends the same text and follow-up as a new ask', async () => {
    const api = fakeApi()
    api.create.mockResolvedValue(ask(3))
    const thread = new AtlasThread(api, fakeClock().clock)
    await thread.retry(ask(2, { text: 'Again?', reply_to: 1, state: 'failed', open: false }))
    expect(api.create).toHaveBeenCalledWith('Again?', 1)
  })

  it('loads older pages before the oldest id', async () => {
    const api = fakeApi({ results: [ask(40, { state: 'done', open: false })], has_more: true })
    const thread = new AtlasThread(api, fakeClock().clock)
    thread.setActive(true); await flush()
    api.list.mockResolvedValueOnce({ results: [ask(12, { state: 'done', open: false })], has_more: false })
    await thread.loadOlder()
    expect(api.list).toHaveBeenLastCalledWith(40)
    expect(thread.snapshot()).toMatchObject({ hasMore: false })
    expect(thread.snapshot().asks.map(a => a.id)).toEqual([40, 12])
  })
})
