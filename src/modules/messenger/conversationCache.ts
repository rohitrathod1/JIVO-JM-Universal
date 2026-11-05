import { ConversationCache } from './conversationCacheController'
import { conversationCacheStorage } from './conversationCacheStorage'
export const conversationCache = new ConversationCache(conversationCacheStorage)
