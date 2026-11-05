import { describe, expect, it } from 'vitest'

import type { Message, MessageWindow } from '../api'
import { advanceReceipts, append, applyChanges, fromWindow, hasGap, MAX_MESSAGES, patchMessage, prepend, statusFor, tombstone, upsert } from './window'

function msg(seq: number, extra: Partial<Message> = {}): Message {
  return {
    id: `m${seq}`, conversation: 'c', seq, sender: { id: 'me', name: 'Me', avatar_url: null, company: null, is_active: true },
    client_id: null, kind: 'text', body: `message ${seq}`, mentions: [], reply_to: null, attachments: [], reactions: [],
    forwarded: false, edited_at: null, deleted: false, deleted_by_moderator: false, system: null,
    created_at: '2026-10-06T10:00:00Z', updated_at: '2026-10-06T10:00:00Z', status: 'sent',
    can: { edit: true, delete_for_everyone: true, react: true, reply: true, forward: true }, ...extra,
  }
}

function win(seqs: number[], extra: Partial<MessageWindow> = {}): MessageWindow {
  return {
    results: seqs.map((s) => msg(s)), mode: 'latest', oldest_seq: seqs[0] ?? null, newest_seq: seqs.at(-1) ?? null,
    has_more_before: false, has_more_after: false, first_unread_seq: null, last_read_seq: 0, last_seq: seqs.at(-1) ?? 0,
    visible_from_seq: 1, receipts: { read_seq: 0, delivered_seq: 0 }, server_time: '2026-10-06T10:00:00Z', ...extra,
  }
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe('progressive history window', () => {
  it('opens on the latest batch, then prepends older batches above without gaps or duplicates', () => {
    let s = fromWindow(win(range(81, 130), { has_more_before: true }))
    s = prepend(s, win(range(31, 80), { has_more_before: true }))
    s = prepend(s, win(range(1, 30), { has_more_before: false }))
    expect(s.messages.map((m) => m.seq)).toEqual(range(1, 130))
    expect(s.hasMoreBefore).toBe(false)
  })

  it('merges overlaps by seq (server copy wins)', () => {
    const s = prepend(fromWindow(win(range(10, 20))), { ...win(range(5, 12)), results: range(5, 12).map((n) => msg(n, { body: `new ${n}` })) })
    expect(s.messages.map((m) => m.seq)).toEqual(range(5, 20))
    expect(s.messages.find((m) => m.seq === 11)?.body).toBe('new 11')
  })

  it('caps memory: prepending past the limit drops the newest and marks more after', () => {
    let s = fromWindow(win(range(MAX_MESSAGES + 1, MAX_MESSAGES + 50), { has_more_before: true }))
    s = prepend(s, win(range(1, MAX_MESSAGES), { has_more_before: false }))
    expect(s.messages).toHaveLength(MAX_MESSAGES)
    expect(s.messages[0].seq).toBe(1)
    expect(s.hasMoreAfter).toBe(true)
  })

  it('appends new messages at the live end and caps from the top', () => {
    let s = fromWindow(win(range(1, MAX_MESSAGES)))
    s = append(s, win(range(MAX_MESSAGES + 1, MAX_MESSAGES + 10)))
    expect(s.messages.at(-1)?.seq).toBe(MAX_MESSAGES + 10)
    expect(s.messages).toHaveLength(MAX_MESSAGES)
    expect(s.hasMoreBefore).toBe(true)
  })

  it('applies edits/deletes only to loaded messages', () => {
    const s = applyChanges(fromWindow(win(range(10, 20))), { ...win([]), results: [msg(15, { deleted: true, body: '' }), msg(3, { body: 'not loaded' })] })
    expect(s.messages.find((m) => m.seq === 15)?.deleted).toBe(true)
    expect(s.messages.some((m) => m.seq === 3)).toBe(false)
  })

  it('upserts a sent message and detects gaps', () => {
    const s = fromWindow(win(range(1, 5)))
    expect(hasGap(s, 6)).toBe(false)
    expect(hasGap(s, 8)).toBe(true)
    expect(upsert(s, msg(6)).messages.map((m) => m.seq)).toEqual(range(1, 6))
    const away = { ...s, hasMoreAfter: true }
    const incoming = upsert(away, msg(99)); expect(incoming.messages).toBe(away.messages); expect(incoming.lastSeq).toBe(99) // indicate arrival without replacing history
  })

  it('computes ticks for my messages from receipts', () => {
    const receipts = { read_seq: 3, delivered_seq: 5 }
    expect(statusFor(msg(3), 'me', receipts)).toBe('read')
    expect(statusFor(msg(5), 'me', receipts)).toBe('delivered')
    expect(statusFor(msg(6), 'me', receipts)).toBe('sent')
    expect(statusFor(msg(2, { sender: { id: 'other', name: 'O', avatar_url: null, company: null, is_active: true } }), 'me', receipts)).toBeNull()
  })
})

describe('live patches', () => {
  const base = () => fromWindow(win([1, 2, 3]))

  it('patches a loaded message by seq and ignores unknown seqs', () => {
    const s = patchMessage(base(), 2, { body: 'edited', edited_at: '2026-10-06T10:00:00Z' })
    expect(s.messages[1].body).toBe('edited')
    expect(patchMessage(s, 99, { body: 'x' })).toBe(s)
  })

  it('tombstones a deleted message', () => {
    const s = patchMessage(base(), 1, tombstone(true, '2026-10-06T10:00:00Z'))
    expect(s.messages[0]).toMatchObject({ deleted: true, deleted_by_moderator: true, body: '', attachments: [] })
    expect(s.messages[0].can.react).toBe(false)
  })

  it('receipts never go backwards and read implies delivered', () => {
    const s = advanceReceipts(base(), { read_seq: 2, delivered_seq: 0 })
    expect(s.receipts).toEqual({ read_seq: 2, delivered_seq: 2 })
    expect(advanceReceipts(s, { read_seq: 1, delivered_seq: 1 })).toBe(s)
  })
})

it('preserves server-confirmed read/delivered state while receipt updates catch up', () => {
  const receipts = { read_seq: 0, delivered_seq: 0 }
  expect(statusFor(msg(8, { status: 'read' }), 'me', receipts)).toBe('read')
  expect(statusFor(msg(8, { status: 'delivered' }), 'me', receipts)).toBe('delivered')
  expect(statusFor(msg(8), 'me', receipts)).toBe('sent')
})
