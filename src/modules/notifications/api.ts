import { api } from '@/core/api/client'
import type { Me } from '@/core/auth/types'

/** Notifications, preferences and push (Stage B API §4, §8). */

export interface AppNotification {
  id: string
  kind: string
  title: string
  body: string
  link: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface Preferences {
  push_enabled: boolean
  push_preview: 'none' | 'sender' | 'sender_and_text'
  dnd_start: string | null
  dnd_end: string | null
  mentions_override_mute: boolean
  jp_push: boolean
  sound_enabled: boolean
  vibrate_enabled: boolean
}

export const notificationKeys = {
  list: ['notifications', 'list'] as const,
  preview: ['notifications', 'preview'] as const,
  preferences: ['notifications', 'preferences'] as const,
  alertsActive: ['notifications', 'alerts', 'active'] as const,
  alertsHistory: ['notifications', 'alerts', 'history'] as const,
  adminAlerts: ['admin', 'alerts'] as const,
}

// --- JM alerts ------------------------------------------------------------------------------------------------
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface JmAlert {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  dismissible: boolean
  created_at: string
  expires_at: string | null
  status: 'active' | 'expired' | 'cancelled'
  dismissed_at: string | null
  sender: { id: string; name: string } | null
}

export interface AdminAlert extends JmAlert {
  audience: 'all' | 'selected'
  recipient_count: number
  cancelled_at: string | null
}

export interface NewAlert {
  title: string
  message: string
  severity: AlertSeverity
  audience: 'all' | 'selected'
  user_ids?: string[]
  expires_at?: string | null
  dismissible: boolean
}

export interface AlertPerson {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

export const activeAlerts = async () => (await api.get<{ results: JmAlert[] }>('/alerts/active/')).data.results
export const alertHistory = async (cursor?: string | null) =>
  (await api.get<{ results: JmAlert[]; next_cursor: string | null }>('/alerts/', { params: { cursor: cursor || undefined } })).data
export const dismissAlert = async (id: string) => api.post(`/alerts/${id}/dismiss/`)
export const adminAlerts = async (cursor?: string | null) =>
  (await api.get<{ results: AdminAlert[]; next_cursor: string | null }>('/admin/alerts/', { params: { cursor: cursor || undefined } })).data
export const createAlert = async (data: NewAlert) => (await api.post<AdminAlert>('/admin/alerts/', data)).data
export const cancelAlert = async (id: string) => (await api.post<AdminAlert>(`/admin/alerts/${id}/cancel/`)).data
/** Soft delete from the sent list; the server refuses alerts that are still active. */
export const deleteAlert = async (id: string) => {
  await api.delete(`/admin/alerts/${id}/`)
}
export const alertPeople = async (q: string, cursor?: string | null) =>
  (await api.get<{ results: AlertPerson[]; next_cursor: string | null }>('/admin/alerts/people/', { params: { q: q || undefined, cursor: cursor || undefined } })).data

export type ReadFilter = 'all' | 'unread' | 'read'
export type KindFilter = 'all' | 'messages' | 'alerts'
export const listNotifications = async (cursor?: string | null, limit = 30, filter: { state?: ReadFilter; kind?: KindFilter } = {}) =>
  (await api.get<{ results: AppNotification[]; next_cursor: string | null }>('/notifications/', {
    params: { cursor: cursor || undefined, limit, state: filter.state && filter.state !== 'all' ? filter.state : undefined, kind: filter.kind && filter.kind !== 'all' ? filter.kind : undefined },
  })).data
/** Soft delete: the notifications disappear from the list; the server keeps the rows (inactive). */
export const deleteNotifications = async (target: string[] | { all: true; state?: ReadFilter; kind?: KindFilter }) =>
  (await api.post<{ removed: number }>('/notifications/delete/', Array.isArray(target) ? { ids: target } : target)).data
export const markNotificationsRead = async (ids: string[] | 'all') =>
  api.post('/notifications/read/', ids === 'all' ? { all: true } : { ids })
export const getPreferences = async () => (await api.get<Preferences>('/me/notification-preferences/')).data
export const updatePreferences = async (data: Partial<Preferences>) => (await api.patch<Preferences>('/me/notification-preferences/', data)).data
export const updatePrivacy = async (last_seen_privacy: Me['last_seen_privacy']) => (await api.patch<Me>('/me/', { last_seen_privacy })).data
export const getVapidKey = async () => (await api.get<{ key: string | null; enabled: boolean }>('/push/vapid-public-key/')).data
export const saveSubscription = async (sub: PushSubscriptionJSON) => api.post('/push/subscriptions/', { endpoint: sub.endpoint, keys: sub.keys })
// Also used while signing out, when the session may already be gone: a 401 here must not count as
// "session lost" (that would run the sign-out cleanups again).
export const deleteCurrentSubscription = async () => api.delete('/push/subscriptions/current/', { validateStatus: () => true })
export const sendTestPush = async () => (await api.post<{ devices: number }>('/push/test/')).data
