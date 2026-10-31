import { api } from '@/core/api/client'
import type { Me } from '@/core/auth/types'

export interface DeviceSession {
  id: string
  device_label: string
  auth_method: string
  created_at: string
  last_seen_at: string
  ip_last: string | null
  current: boolean
}

export const profileKeys = { sessions: ['profile', 'sessions'] as const }

export const updateMe = async (data: Partial<Pick<Me, 'display_name' | 'phone' | 'bio'>>) => (await api.patch<Me>('/me/', data)).data
export const setMyPhoto = async (upload_id: string, signal?: AbortSignal) => api.put('/me/avatar/', { upload_id }, { signal })
export const removeMyPhoto = async (signal?: AbortSignal) => api.delete('/me/avatar/', { signal })
/** Asks to change the sign-in email (confirm it's you first); an administrator confirms the change. */
export const requestEmailChange = async (email: string) => (await api.post<Me>('/me/email/', { email })).data
export const cancelEmailChange = async () => (await api.delete<Me>('/me/email/')).data
export const changePassword = async (current_password: string, new_password: string) =>
  api.post('/auth/password/change/', { current_password, new_password })
export const listSessions = async () => (await api.get<DeviceSession[]>('/auth/sessions/')).data
export const revokeSession = async (id: string) => api.delete(`/auth/sessions/${id}/`)
export const revokeOtherSessions = async () => (await api.post<{ revoked: number }>('/auth/sessions/revoke-others/')).data
