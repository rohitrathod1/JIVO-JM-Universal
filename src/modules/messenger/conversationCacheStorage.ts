import type { CacheStorage } from './conversationCacheController'
// Browsers have no OS-protected key store equivalent to native SecureStore.
// Keep private history in this tab until a secure persistent unlock design exists.
let value: string | null = null
export const conversationCacheStorage: CacheStorage = {
  read: async () => value,
  write: async next => { value = next },
  clear: async () => { value = null },
}
