/** Display formats: DD-MMM-YYYY dates, relative times for recent activity (JIVO convention). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value
}

/** 05-Oct-2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = toDate(value)
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

/** 05-Oct-2026, 14:05 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = toDate(value)
  return `${formatDate(d)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "just now", "12 min ago", "3 h ago", "yesterday", then the date. */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '—'
  const d = toDate(value)
  const seconds = Math.round((now.getTime() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`
  if (seconds < 172_800) return 'yesterday'
  return formatDate(d)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
