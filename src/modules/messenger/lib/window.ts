import type { DeliveryStatus, Message, MessageWindow } from '../api'

/**
 * The loaded slice of one conversation's history, ascending by seq.
 *
 * Progressive loading (WhatsApp-style): open → latest ~50; scroll up → `before=<oldest seq>` batches are
 * *prepended*; new messages are *appended*. Retrieval is by seq cursor, never by page number. At most
 * MAX_MESSAGES stay in memory: loading in one direction drops the far end of the other.
 */
export interface WindowState {
  messages: Message[]
  hasMoreBefore: boolean
  hasMoreAfter: boolean
  lastSeq: number
  visibleFrom: number
  receipts: { read_seq: number; delivered_seq: number }
  serverTime: string | null
}

export const MAX_MESSAGES = 1000

export const emptyWindow: WindowState = {
  messages: [],
  hasMoreBefore: false,
  hasMoreAfter: false,
  lastSeq: 0,
  visibleFrom: 1,
  receipts: { read_seq: 0, delivered_seq: 0 },
  serverTime: null,
}

/** Union of two seq-sorted lists; for the same seq the entry from `incoming` wins. */
export function mergeBySeq(current: Message[], incoming: Message[]): Message[] {
  const bySeq = new Map<number, Message>()
  for (const m of current) bySeq.set(m.seq, m)
  for (const m of incoming) bySeq.set(m.seq, m)
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}

function meta(state: WindowState, w: MessageWindow): WindowState {
  return { ...state, lastSeq: Math.max(state.lastSeq, w.last_seq), visibleFrom: w.visible_from_seq, receipts: w.receipts, serverTime: w.server_time }
}

/** A fresh window (open, jump to latest, jump to a replied message). */
export function fromWindow(w: MessageWindow): WindowState {
  return meta(
    { ...emptyWindow, messages: [...w.results], hasMoreBefore: Boolean(w.has_more_before), hasMoreAfter: Boolean(w.has_more_after) },
    w,
  )
}

/** Older messages arrived (scrolling up): insert above, maybe drop the newest beyond the cap. */
export function prepend(state: WindowState, w: MessageWindow): WindowState {
  let messages = mergeBySeq(state.messages, w.results)
  let hasMoreAfter = state.hasMoreAfter
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(0, MAX_MESSAGES)
    hasMoreAfter = true
  }
  return meta({ ...state, messages, hasMoreBefore: Boolean(w.has_more_before), hasMoreAfter }, w)
}

/** Newer messages arrived (polling at the live end, or scrolling down after a jump). */
export function append(state: WindowState, w: MessageWindow): WindowState {
  let messages = mergeBySeq(state.messages, w.results)
  let hasMoreBefore = state.hasMoreBefore
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(messages.length - MAX_MESSAGES)
    hasMoreBefore = true
  }
  return meta({ ...state, messages, hasMoreBefore, hasMoreAfter: Boolean(w.has_more_after) }, w)
}

/** Edits, deletions and reaction changes for messages already loaded (others are ignored). */
export function applyChanges(state: WindowState, w: MessageWindow): WindowState {
  const loaded = new Set(state.messages.map((m) => m.seq))
  const relevant = w.results.filter((m) => loaded.has(m.seq))
  return meta({ ...state, messages: relevant.length ? mergeBySeq(state.messages, relevant) : state.messages }, w)
}

/** One message from the server (the reply to a send, an edit, a reaction change). */
export function upsert(state: WindowState, message: Message): WindowState {
  const newest = state.messages.at(-1)?.seq ?? 0
  if (state.hasMoreAfter && message.seq > newest) return { ...state, lastSeq: Math.max(state.lastSeq, message.seq) } // retain history while indicating arrivals
  const merged = mergeBySeq(state.messages, [message])
  return { ...state, messages: merged.slice(-MAX_MESSAGES), hasMoreBefore: state.hasMoreBefore || merged.length > MAX_MESSAGES, lastSeq: Math.max(state.lastSeq, message.seq) }
}

export function removeHidden(state: WindowState, messageId: string): WindowState {
  return { ...state, messages: state.messages.filter((m) => m.id !== messageId) }
}

/** True when the slice is at the live end but a newer seq exists that we have not loaded. */
export function hasGap(state: WindowState, seq: number): boolean {
  const newest = state.messages.at(-1)?.seq ?? state.visibleFrom - 1
  return !state.hasMoreAfter && seq > newest + 1
}

export const oldestSeq = (state: WindowState) => state.messages[0]?.seq ?? null
export const newestSeq = (state: WindowState) => state.messages.at(-1)?.seq ?? null

/** Ticks for my own messages from the conversation's receipts (lowest read / delivered among the others). */
export function statusFor(message: Message, myId: string, receipts: WindowState['receipts']): DeliveryStatus | null {
  if (message.sender?.id !== myId || message.kind === 'system') return null
  if (message.seq <= receipts.read_seq) return 'read'
  if (message.seq <= receipts.delivered_seq) return 'delivered'
  return 'sent'
}

/** A live change to a loaded message (edit, delete, reaction). Unknown seqs are ignored. */
export function patchMessage(state: WindowState, seq: number, patch: Partial<Message>): WindowState {
  let changed = false
  const messages = state.messages.map((m) => {
    if (m.seq !== seq) return m
    changed = true
    return { ...m, ...patch }
  })
  return changed ? { ...state, messages } : state
}

/** What a message looks like once deleted for everyone (the server's tombstone, applied locally). */
export function tombstone(byModerator: boolean, updatedAt: string): Partial<Message> {
  return {
    body: '', attachments: [], reactions: [], mentions: [], deleted: true, deleted_by_moderator: byModerator, edited_at: null,
    updated_at: updatedAt, can: { edit: false, delete_for_everyone: false, react: false, reply: false, forward: false },
  }
}

/** Receipts only move forward (✓ → ✓✓ → blue). */
export function advanceReceipts(state: WindowState, receipts: WindowState['receipts']): WindowState {
  const next = {
    read_seq: Math.max(state.receipts.read_seq, receipts.read_seq),
    delivered_seq: Math.max(state.receipts.delivered_seq, receipts.delivered_seq, receipts.read_seq),
  }
  if (next.read_seq === state.receipts.read_seq && next.delivered_seq === state.receipts.delivered_seq) return state
  return { ...state, receipts: next }
}

