/**
 * One inbox for every approval (backend core.approvals, Frontend FE-023): administration requests, Passwords
 * vault owner requests and emergency access. Pure helpers only; the screen and the API live next to this.
 */
import type { Capability } from '../../config/capabilities'

/** Same gate as the web navigation entry: administration approvals or Passwords requests. */
export const APPROVALS_ACCESS: readonly Capability[] = ['ADMIN_USERS', 'JP_ACCESS']

export type ApprovalKind ='admin' | 'vault_owner' | 'emergency_access'
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired' | 'revoked' | 'active'
export type ApprovalDecision = 'approve' | 'deny' | 'cancel'
export type ApprovalFilter = 'waiting' | 'mine' | 'all'

interface Person { id: string; name: string; email?: string }

export interface ApprovalItem {
  kind: ApprovalKind
  id: string
  title: string
  subject: string
  reason: string
  status: ApprovalStatus
  requested_by: Person | null
  requested_at: string
  expires_at: string | null
  decided_by: Person | null
  decided_at: string | null
  can: { decide: boolean; cancel: boolean }
  /** Full paths of the endpoints that decide this item (e.g. /api/jp/owner-requests/1/approve/). */
  actions: { approve: string; deny: string; cancel: string }
  /** Where the item lives in the reference web app. */
  link: string
}

export interface ApprovalList { results: ApprovalItem[]; waiting_on_me: number }

export const FILTERS: readonly (readonly [ApprovalFilter, string])[] = [['waiting', 'Waiting on me'], ['mine', 'My requests'], ['all', 'History']]

export const KIND_LABEL: Record<ApprovalKind, string> = {
  admin: 'Administration',
  vault_owner: 'Passwords · vault owner',
  emergency_access: 'Passwords · emergency access',
}

const CONFIRM: Record<ApprovalKind, string> = {
  admin: 'It runs as you, and is recorded.',
  vault_owner: 'The person gets (or loses) full control of the vault. It is recorded.',
  emergency_access: 'They can open the vault’s passwords for a limited time. The vault’s owners are told, and it is recorded.',
}

/** "Waiting on me" and "My requests" read the pending list; "History" reads everything. */
export const statusFor = (filter: ApprovalFilter): 'pending' | 'all' => (filter === 'all' ? 'all' : 'pending')

export function rowsFor(items: readonly ApprovalItem[], filter: ApprovalFilter): ApprovalItem[] {
  if (filter === 'waiting') return items.filter(i => i.can.decide)
  if (filter === 'mine') return items.filter(i => i.can.cancel)
  return [...items]
}

export function emptyTitle(filter: ApprovalFilter): string {
  return filter === 'waiting' ? 'Nothing waiting on you.' : filter === 'mine' ? 'You have no open requests.' : 'No requests yet.'
}

export type StatusTone = 'warning' | 'success' | 'danger' | 'neutral'
export function statusTone(status: string): StatusTone {
  if (status === 'pending') return 'warning'
  if (status === 'approved' || status === 'active') return 'success'
  if (status === 'denied') return 'danger'
  return 'neutral'
}

export function confirmCopy(item: ApprovalItem, decision: 'approve' | 'deny') {
  return decision === 'approve'
    ? { title: `Approve: ${item.title}?`, body: CONFIRM[item.kind] ?? 'It is recorded.', label: 'Approve' }
    : { title: 'Deny this request?', body: 'Nothing will change. The person who asked is told.', label: 'Deny' }
}

export function doneMessage(decision: ApprovalDecision): string {
  return decision === 'approve' ? 'Approved' : decision === 'deny' ? 'Denied' : 'Request withdrawn'
}

/** Navigation badge text: hidden at 0, capped at 99+. */
export function badgeText(count: number | null | undefined): string {
  if (!count || count < 0) return ''
  return count > 99 ? '99+' : String(count)
}

/** "Asked by … · when · expires … · approved by …" (same order as the web row). */
export function metaLine(item: ApprovalItem, format: (value: string) => string): string {
  let line = `Asked by ${item.requested_by?.name ?? 'someone'} · ${format(item.requested_at)}`
  if (item.status === 'pending' && item.expires_at) line += ` · expires ${format(item.expires_at)}`
  if (item.decided_by) line += ` · ${item.status} by ${item.decided_by.name}`
  return line
}

/**
 * Split a server-provided full action path into the transport's base (JM or JP) and a relative path.
 * Anything outside /api/jm/ or /api/jp/, or with traversal/encoding tricks, is refused (null).
 */
export function endpointFor(path: string): { base: 'jm' | 'jp'; url: string } | null {
  const match = /^\/api\/(jm|jp)(\/[A-Za-z0-9_\-/]+\/)$/.exec(path)
  if (!match) return null
  const url = match[2]
  if (url.startsWith('//') || url.split('/').some(s => s === '.' || s === '..')) return null
  return { base: match[1] as 'jm' | 'jp', url }
}

/** Map the web app's link for an item to the matching Universal route. */
export function appHref(item: Pick<ApprovalItem, 'kind' | 'link'>): string {
  if (item.kind === 'admin') return '/admin?tab=approvals'
  if (item.kind === 'emergency_access') return '/passwords?view=break-glass'
  const vault = /^\/passwords\/vaults\/([A-Za-z0-9_-]+)\/?$/.exec(item.link)?.[1]
  return vault ? `/passwords?vault=${encodeURIComponent(vault)}` : '/passwords'
}

/** One-time links some admin approvals return (reset link), in any of the shapes the server uses. */
export function resultLink(result: unknown): string {
  const r = result as { link?: unknown; result?: { link?: unknown } } | null | undefined
  const link = r?.result?.link ?? r?.link
  return typeof link === 'string' ? link : ''
}
