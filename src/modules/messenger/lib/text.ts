/** Message text helpers: links, mentions, times and day labels. Message bodies are plain text, never HTML. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type Segment = { type: 'text'; value: string } | { type: 'link'; value: string; href: string } | { type: 'mention'; value: string }

const LINK = /\b(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}]|mailto:[^\s<>"']+)/gi

/** Split a body into text, link and mention segments. Only http(s) and mailto links become links. */
export function segments(body: string, mentionNames: string[] = []): Segment[] {
  const out: Segment[] = []
  const names = mentionNames.filter(Boolean).sort((a, b) => b.length - a.length)
  const mentionPattern = names.length ? new RegExp(`@(${names.map(escape).join('|')})`, 'g') : null

  const pushText = (text: string) => {
    if (!text) return
    if (!mentionPattern) {
      out.push({ type: 'text', value: text })
      return
    }
    let last = 0
    for (const match of text.matchAll(mentionPattern)) {
      if (match.index! > last) out.push({ type: 'text', value: text.slice(last, match.index) })
      out.push({ type: 'mention', value: match[0] })
      last = match.index! + match[0].length
    }
    if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  }

  let last = 0
  for (const match of body.matchAll(LINK)) {
    pushText(body.slice(last, match.index))
    out.push({ type: 'link', value: match[0], href: match[0] })
    last = match.index! + match[0].length
  }
  pushText(body.slice(last))
  return out
}

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** "14:05" */
export function clockTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

/** "Today", "Yesterday", weekday within a week, then "05-Oct-2026". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' })
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

/** Conversation-list time: clock time today, "Yesterday", weekday, then a short date. */
export function listTime(iso: string, now: Date = new Date()): string {
  const label = dayLabel(iso, now)
  if (label === 'Today') return clockTime(iso)
  if (/^\d{2}-/.test(label)) {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}`
  }
  return label
}

/** The composer's mention token, turned into "@Name" by the server for current members. */
export function mentionToken(name: string, userId: string): string {
  return `@[${name.replace(/[\][\n]/g, '')}](${userId})`
}

/** "@Name" typed in the composer → server mention tokens, for current members (longest names first). */
export function withMentionTokens(text: string, members: { user: { id: string; name: string }; is_me: boolean }[]): string {
  const people = members.filter((m) => !m.is_me).sort((a, b) => b.user.name.length - a.user.name.length)
  if (!people.length) return text
  const pattern = new RegExp(`@(${people.map((m) => escape(m.user.name)).join('|')})(?![\\w])`, 'g')
  return text.replace(pattern, (_, name: string) => {
    const member = people.find((m) => m.user.name === name)!
    return mentionToken(member.user.name, member.user.id)
  })
}

/** A mute that has not ended yet ("forever" is stored as year 9999). */
export function isMuted(mutedUntil: string | null, now: Date = new Date()): boolean {
  return mutedUntil !== null && new Date(mutedUntil) > now
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

/** More emojis for the reaction picker ("+"); any emoji can also be typed from the phone's emoji keyboard. */
export const MORE_REACTIONS = [
  '😀', '😁', '😅', '🤣', '😊', '😍', '😘', '😎', '🤔', '😐', '🙄', '😴',
  '😡', '😭', '😱', '🥳', '🤯', '🥺', '😇', '🤗', '🤝', '👏', '🙌', '💪',
  '👌', '✌️', '👎', '🔥', '💯', '✅', '❌', '⭐', '🎉', '💡', '📌', '⚠️',
  '💚', '💙', '💔', '🙈', '🚀', '☕', '🍵', '🎂', '💰', '📦', '🚚', '🏭',
] as const

/** The first emoji in what was typed (one emoji may be several code points: flags, skin tones, ZWJ). */
export function firstEmoji(text: string): string | null {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter
  const parts = Segmenter ? [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((p) => p.segment) : [...text]
  return parts.find((g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g)) ?? null
}

/** Search highlight "[[word]]" markers → segments, rendered as <mark> without HTML injection. */
export function highlightParts(text: string): { text: string; hit: boolean }[] {
  return text.split(/(\[\[.*?\]\])/g).filter(Boolean).map((part) =>
    part.startsWith('[[') && part.endsWith(']]') ? { text: part.slice(2, -2), hit: true } : { text: part, hit: false },
  )
}

/** "last seen today at 14:05", "last seen yesterday at 09:10", "last seen 03-Oct at 18:00". */
export function lastSeenLabel(iso: string, now: Date = new Date()): string {
  const label = dayLabel(iso, now)
  const day = label === 'Today' ? 'today' : label === 'Yesterday' ? 'yesterday' : /^\d{2}-/.test(label) ? listTime(iso, now) : label
  return `last seen ${day} at ${clockTime(iso)}`
}

/** "typing…", "Ravi is typing…", "Ravi and Meena are typing…", "3 people are typing…". */
export function typingLabel(names: string[], group: boolean): string {
  if (!group || names.length === 0) return 'typing…'
  const first = (n: string) => n.split(' ')[0]
  if (names.length === 1) return `${first(names[0])} is typing…`
  if (names.length === 2) return `${first(names[0])} and ${first(names[1])} are typing…`
  return `${names.length} people are typing…`
}

/** A duration as m:ss (voice messages). */
export function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Text split around every case-insensitive occurrence of ``term`` (chat search highlighting). */
export function markParts(text: string, term: string): { text: string; hit: boolean }[] {
  const t = term.trim()
  if (t.length < 2) return [{ text, hit: false }]
  const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const out: { text: string; hit: boolean }[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), hit: false })
    out.push({ text: m[0], hit: true })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false })
  return out.length ? out : [{ text, hit: false }]
}

/** The first http(s) link in a message, for its preview. */
export function firstLink(body: string): string | null {
  const s = segments(body).find((x) => x.type === 'link' && /^https?:/i.test(x.href))
  return s && s.type === 'link' ? s.href : null
}
