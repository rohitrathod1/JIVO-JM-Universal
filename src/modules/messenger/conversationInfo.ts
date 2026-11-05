import type { ConversationItem, Member, Message, SendMode } from './api'

/** Group info lists the first 5 members, then 10 more at a time (Frontend GroupInfo). */
export const MEMBERS_FIRST = 5
export const MEMBERS_MORE = 10

/** The members on screen: everyone matching a search, or the first `shown` of all members. */
export function memberWindow(rows: Member[], term: string, shown: number): { visible: Member[]; matching: Member[]; left: number } {
  const needle = term.trim().toLowerCase()
  const matching = needle ? rows.filter(m => `${m.user.name} ${m.user.company ?? ''}`.toLowerCase().includes(needle)) : rows
  const visible = needle ? matching : matching.slice(0, shown)
  return { visible, matching, left: matching.length - visible.length }
}

export function moreMembersLabel(left: number): string {
  return left > MEMBERS_MORE ? `Show ${MEMBERS_MORE} more · ${left} left` : `Show ${left} more`
}

export const SEND_MODES: { value: SendMode; label: string; detail: string }[] = [
  { value: 'everyone', label: 'Everyone can send', detail: 'All members can send messages, files, voice messages and polls.' },
  { value: 'selected', label: 'Selected members can send', detail: 'Admins and the members you choose. Everyone else can read, react and vote.' },
  { value: 'admins', label: 'Admins only', detail: 'For announcements: only the owner and admins can send.' },
]

/** What a member who cannot change the setting is told about who may send (null when everyone can). */
export function sendModeNote(mode: SendMode, blocked: boolean): string | null {
  if (mode === 'everyone') return null
  return `${mode === 'admins' ? 'Only admins can send messages in this group.' : 'Only selected members can send messages in this group.'}${blocked ? ' You can read, react and vote.' : ' You can send.'}`
}

/** A mailto: link for a plain address; anything carrying extra headers, spaces or control codes is refused. */
export function safeMailHref(email: string | null | undefined): string | null {
  const value = email?.trim()
  return value && /^[^\s@?&#/\\:<>"]+@[^\s@?&#/\\:<>"]+\.[^\s@?&#/\\:<>"]+$/.test(value) ? `mailto:${value}` : null
}

/** The direct chat whose peer may be dialled from the header (the phone itself comes from their profile). */
export function dialablePeer(conversation: Pick<ConversationItem, 'kind' | 'is_self' | 'peer' | 'locked'>): string | null {
  return conversation.kind === 'direct' && !conversation.is_self && conversation.peer?.is_active && !conversation.locked ? conversation.peer.id : null
}

/** A system notice with no text (a kind JM no longer has, e.g. the removed in-app calls) renders nothing. */
export function isEmptySystemNotice(message: Pick<Message, 'kind' | 'system'>): boolean {
  return message.kind === 'system' && !message.system?.text?.trim()
}

/** The line under the chat title when there is no live presence/typing label (Frontend ChatView header). */
export function headerInfo(conversation: Pick<ConversationItem, 'kind' | 'is_self' | 'member_count' | 'restricted_company' | 'peer'>): string {
  if (conversation.is_self) return 'Message yourself'
  if (conversation.kind === 'group') return `${conversation.member_count} members${conversation.restricted_company ? ` · ${conversation.restricted_company} only` : ''}`
  return conversation.peer?.company ?? ''
}
