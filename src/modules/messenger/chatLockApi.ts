import { api } from '../../core/api/client'
import type { ConversationDetail, ConversationItem, CursorPage } from './api'

// This endpoint requires app_unlock when the backend's session grant is absent.
// The common transport obtains the server-offered factor and retries only once.
export const verifyLockedChats = async (signal: AbortSignal): Promise<void> => {
  await api.get<CursorPage<ConversationItem>>('/conversations/', { params: { filter: 'locked', limit: 1 }, signal })
}
export const setConversationLock = async (id: string, locked: boolean, signal: AbortSignal): Promise<ConversationDetail> =>
  (await api.patch<ConversationDetail>(`/conversations/${id}/settings/`, { locked }, { signal })).data
