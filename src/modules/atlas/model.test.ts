import { describe, expect, it } from 'vitest'
import { answerView, canSend, counter, FAST_POLL_MS, mergeAsks, pollDelay, quote, sendFailure, SLOW_POLL_MS, stateLine, type Ask } from './model'

const T0 = Date.parse('2026-11-05T10:00:00Z')
const ask =(id: number, patch: Partial<Ask> = {}): Ask => ({ id, text: `Question ${id}`, state: 'queued', answer: null, with: null, error_message: null, reply_to: null, created_at: new Date(T0).toISOString(), answered_at: null, open: true, ...patch })
const axiosError = (status: number | null, data: unknown = {}) => ({ isAxiosError: true, message: 'x', response: status === null ? undefined : { status, data } })

describe('Atlas polling schedule (contract)', () => {
  it('polls every 2 s for the first 3 minutes, then every 30 s', () => {
    expect(pollDelay(ask(1, { state: 'working' }), T0 + 10_000)).toBe(FAST_POLL_MS)
    expect(pollDelay(ask(1, { state: 'queued' }), T0 + 179_000)).toBe(FAST_POLL_MS)
    expect(pollDelay(ask(1, { state: 'working' }), T0 + 181_000)).toBe(SLOW_POLL_MS)
  })
  it('with_person is always slow', () => {
    expect(pollDelay(ask(1, { state: 'with_person' }), T0 + 1_000)).toBe(SLOW_POLL_MS)
  })
  it('stops on terminal states and when the server says the ask is closed', () => {
    for (const state of ['done', 'held', 'refused', 'failed'] as const) expect(pollDelay(ask(1, { state, open: true }), T0)).toBeNull()
    expect(pollDelay(ask(1, { state: 'working', open: false }), T0)).toBeNull()
  })
})

describe('Atlas bubbles', () => {
  it('shows a progress line while open, naming the person Atlas is checking with', () => {
    expect(answerView(ask(1, { state: 'working' }))).toMatchObject({ tone: 'pending', text: 'Atlas is working on it...' })
    expect(stateLine({ state: 'with_person', with: 'Accounts' })).toContain('checking with Accounts')
    expect(stateLine({ state: 'with_person', with: null })).toContain('colleague')
  })
  it('shows the answer line for done, held and refused; failed offers Retry', () => {
    expect(answerView(ask(1, { state: 'done', answer: 'Sales were 12 L.', open: false }))).toEqual({ tone: 'answer', text: 'Sales were 12 L.', note: null, retry: false })
    expect(answerView(ask(1, { state: 'held', answer: 'Waiting for approval.', open: false }))).toMatchObject({ tone: 'held', text: 'Waiting for approval.', note: 'Held' })
    expect(answerView(ask(1, { state: 'refused', answer: 'You are not mapped in Atlas.', open: false }))).toMatchObject({ tone: 'refused', text: 'You are not mapped in Atlas.' })
    expect(answerView(ask(1, { state: 'failed', error_message: 'Atlas timed out.', open: false }))).toMatchObject({ tone: 'failed', text: 'Atlas timed out.', retry: true })
    expect(answerView(ask(1, { state: 'failed', open: false })).text).toMatch(/Try again/)
  })
})

describe('Atlas composer', () => {
  it('counts code points against the 4000 limit', () => {
    expect(counter('hi').label).toBe('2/4000')
    expect(counter('\u{1F600}').count).toBe(1)
    expect(counter('a'.repeat(4001)).over).toBe(true)
    expect(counter('a'.repeat(3900)).near).toBe(true)
  })
  it('sends only non-blank text within the limit', () => {
    expect(canSend('  ')).toBe(false)
    expect(canSend('a'.repeat(4000))).toBe(true)
    expect(canSend('a'.repeat(4001))).toBe(false)
  })
  it('quotes the followed-up question on one short line', () => {
    expect(quote('a\n b')).toBe('a b')
    expect(Array.from(quote('x'.repeat(200), 10))).toHaveLength(10)
  })
})

describe('Atlas send failures keep the draft', () => {
  it('503 is retryable and says the question was not sent', () => {
    expect(sendFailure(axiosError(503, { detail: 'Atlas is busy. Your question was not sent.' }))).toMatchObject({ kind: 'unavailable', retryable: true, message: 'Atlas is busy. Your question was not sent.' })
    expect(sendFailure(axiosError(503)).message).toMatch(/not sent/)
  })
  it('429 carries retry_after', () => {
    expect(sendFailure(axiosError(429, { detail: 'Slow down.', retry_after: 12.2 }))).toMatchObject({ kind: 'rate_limited', retryable: true, retryAfter: 13, message: 'Slow down.' })
  })
  it('400/403 show the server line and are not retried', () => {
    expect(sendFailure(axiosError(403, { detail: 'Your account is not linked to Atlas.' }))).toMatchObject({ kind: 'rejected', retryable: false, message: 'Your account is not linked to Atlas.' })
  })
  it('no response is a network failure', () => {
    expect(sendFailure(axiosError(null))).toMatchObject({ kind: 'network', retryable: true })
  })
})

describe('Atlas thread order', () => {
  it('merges by id, newest first, incoming wins', () => {
    const merged = mergeAsks([ask(1), ask(3, { state: 'working' })], [ask(3, { state: 'done', open: false }), ask(2)])
    expect(merged.map(a => a.id)).toEqual([3, 2, 1])
    expect(merged[0].state).toBe('done')
  })
})
