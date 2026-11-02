import type { JmAlert } from './api'
export interface UnreadSummary { unread_conversations: number; unread_messages: number; unread_notifications: number; mention_unread: boolean }
export const emptySummary: UnreadSummary = { unread_conversations: 0, unread_messages: 0, unread_notifications: 0, mention_unread: false }
export function visibleAlerts(alerts: JmAlert[], now = Date.now()) {
  const rank = { critical: 0, warning: 1, info: 2 }
  return alerts.filter(alert => alert.status === 'active' && !alert.dismissed_at && (!alert.expires_at || Date.parse(alert.expires_at) > now))
    .sort((a, b) => rank[a.severity] - rank[b.severity] || b.created_at.localeCompare(a.created_at))
}
