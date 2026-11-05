import { isAxiosError } from 'axios'

/**
 * Ask Atlas (JIVO's business AI) from JM. JM's server is the only party that talks to Atlas (signed bridge
 * calls); this client only uses the JM contract below and never sees Atlas keys or URLs.
 *
 * GET  /api/jm/atlas/status/            -> AtlasStatus
 * GET  /api/jm/atlas/asks/?before&limit -> AskPage (newest first)
 * POST /api/jm/atlas/asks/              -> 201 Ask; 400/403 {detail}; 429 {detail, retry_after}; 503 {detail}
 * GET  /api/jm/atlas/asks/<id>/         -> Ask (the server refreshes from Atlas first when a poll is due)
 */
export const ATLAS_MAX_CHARS = 4000
export const ATLAS_PAGE_SIZE = 30
/** Contract polling: every 2 s while open for the first 3 min, then every 30 s; with_person is always slow. */
export const FAST_POLL_MS = 2_000
export const SLOW_POLL_MS = 30_000
export const FAST_WINDOW_MS = 180_000

export type AskState = 'sending' | 'queued' | 'working' | 'with_person' | 'done' | 'held' | 'refused' | 'failed'
export interface Ask {
  id: number
  text: string
  state: AskState
  answer: string | null
  with: string | null
  error_message: string | null
  reply_to: number | null
  created_at: string
  answered_at: string | null
  open: boolean
}
export interface AskPage { results: Ask[]; has_more: boolean }
export interface AtlasStatus { enabled: boolean; allowed: boolean; message: string | null }

export const TERMINAL_STATES: readonly AskState[] = ['done', 'held', 'refused', 'failed']
export const isTerminal = (state: AskState) => TERMINAL_STATES.includes(state)
/** Still waiting on Atlas: the server says open and the state is not final. */
export const isOpen = (ask: Ask) => ask.open && !isTerminal(ask.state)

/** Milliseconds until this ask should be fetched again, or null when it is finished. */
export function pollDelay(ask: Ask, now: number): number | null {
  if (!isOpen(ask)) return null
  if (ask.state === 'with_person') return SLOW_POLL_MS
  const created = Date.parse(ask.created_at)
  const age = Number.isFinite(created) ? now - created : 0
  return age < FAST_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS
}

/** Characters as the server counts them (code points), so emoji are not counted twice. */
export const charCount = (text: string) => Array.from(text).length
export function counter(text: string) {
  const count = charCount(text)
  return { count, label: `${count}/${ATLAS_MAX_CHARS}`, over: count > ATLAS_MAX_CHARS, near: count > ATLAS_MAX_CHARS - 200 }
}
export const canSend = (text: string) => text.trim().length > 0 && charCount(text) <= ATLAS_MAX_CHARS

export type AnswerTone = 'pending' | 'answer' | 'held' | 'refused' | 'failed'
/** What the left (Atlas) bubble shows for an ask. Only the asker ever receives these from the server. */
export function answerView(ask: Ask): { tone: AnswerTone; text: string; note: string | null; retry: boolean } {
  switch (ask.state) {
    case 'done': return { tone: 'answer', text: ask.answer?.trim() || 'Atlas finished without an answer.', note: null, retry: false }
    case 'held': return { tone: 'held', text: ask.answer?.trim() || 'Atlas is holding this answer for now.', note: 'Held', retry: false }
    case 'refused': return { tone: 'refused', text: ask.answer?.trim() || 'Atlas cannot take this question.', note: 'Not answered', retry: false }
    case 'failed': return { tone: 'failed', text: ask.error_message?.trim() || 'Atlas could not answer this. Try again.', note: 'Failed', retry: true }
    default: return { tone: 'pending', text: stateLine(ask), note: null, retry: false }
  }
}

/** The one-line progress shown while an ask is open. */
export function stateLine(ask: Pick<Ask, 'state' | 'with'>): string {
  switch (ask.state) {
    case 'sending': return 'Sending to Atlas...'
    case 'queued': return 'Atlas has your question. Waiting to start...'
    case 'working': return 'Atlas is working on it...'
    case 'with_person': return ask.with ? `Atlas is checking with ${ask.with}. This can take a while.` : 'Atlas is checking with a colleague. This can take a while.'
    default: return ''
  }
}

/** Newest first by id, one entry per id; the incoming copy wins. */
export function mergeAsks(current: readonly Ask[], incoming: readonly Ask[]): Ask[] {
  const byId = new Map<number, Ask>()
  for (const ask of current) byId.set(ask.id, ask)
  for (const ask of incoming) byId.set(ask.id, ask)
  return [...byId.values()].sort((a, b) => b.id - a.id)
}

export type SendFailure = { kind: 'rate_limited' | 'unavailable' | 'network' | 'rejected' | 'unknown'; message: string; retryable: boolean; retryAfter: number | null }
/** Map a failed POST to what the composer shows. The draft is always kept; only `retryable` offers Retry. */
export function sendFailure(error: unknown): SendFailure {
  if (isAxiosError(error)) {
    const status = error.response?.status
    const data = (error.response?.data ?? {}) as { detail?: unknown; retry_after?: unknown }
    const detail = typeof data.detail === 'string' && data.detail.trim() ? data.detail.trim() : null
    if (!error.response) return { kind: 'network', message: 'Cannot reach JM. Your question was not sent.', retryable: true, retryAfter: null }
    if (status === 429) {
      const after = Number(data.retry_after)
      const retryAfter = Number.isFinite(after) && after > 0 ? Math.ceil(after) : null
      return { kind: 'rate_limited', message: detail ?? `Too many questions. Try again${retryAfter ? ` in ${retryAfter} s` : ' shortly'}.`, retryable: true, retryAfter }
    }
    if (status === 503) return { kind: 'unavailable', message: detail ?? 'Atlas is unavailable right now. Your question was not sent.', retryable: true, retryAfter: null }
    if (status === 400 || status === 403) return { kind: 'rejected', message: detail ?? 'Atlas cannot take this question.', retryable: false, retryAfter: null }
    if (status && status >= 500) return { kind: 'unavailable', message: 'JM could not reach Atlas. Your question was not sent.', retryable: true, retryAfter: null }
    return { kind: 'unknown', message: detail ?? `Request failed (${status}). Please retry.`, retryable: true, retryAfter: null }
  }
  return { kind: 'unknown', message: error instanceof Error ? error.message : 'Something went wrong. Please retry.', retryable: true, retryAfter: null }
}

/** A short quote of the ask being followed up. */
export const quote = (text: string, max = 90) => { const one = text.replace(/\s+/g, ' ').trim(); return charCount(one) > max ? Array.from(one).slice(0, max - 1).join('') + '…' : one }
