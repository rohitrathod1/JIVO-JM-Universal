import type { ConversationItem } from '../api'

export function isSelfChat(chat: Pick<ConversationItem, 'kind' | 'is_self' | 'peer'> | null, userId?: string | null): boolean {
  return !!chat && chat.kind === 'direct' && (chat.is_self === true || (!!userId && chat.peer?.id === userId))
}
