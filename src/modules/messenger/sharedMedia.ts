import type { SharedItem, SharedKind } from './api'

export function sharedKey(item: SharedItem): string {
  return `${item.message.id}:${item.attachment?.id ?? item.url ?? ''}`
}
export function mergeShared(current: SharedItem[], incoming: SharedItem[]): SharedItem[] {
  const items = new Map(current.map(item => [sharedKey(item), item]))
  incoming.forEach(item => items.set(sharedKey(item), item))
  return [...items.values()].sort((a, b) => b.message.seq - a.message.seq)
}
export function safeSharedLink(value: string | undefined): string | null {
  if (!value) return null
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null } catch { return null }
}
export const sharedTabs: { kind: SharedKind; label: string }[] = [
  { kind: 'media', label: 'Media' }, { kind: 'docs', label: 'Docs' },
  { kind: 'links', label: 'Links' },
]
