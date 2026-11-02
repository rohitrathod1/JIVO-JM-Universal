import * as SecureStore from 'expo-secure-store'
import { randomUUID } from 'expo-crypto'
import { SecureSnapshot } from '../../core/storage/secureSnapshot'
import type { CacheStorage } from './conversationCacheController'
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const snapshot = new SecureSnapshot({
  get: key => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: key => SecureStore.deleteItemAsync(key, options),
}, 'jm.history.v1', randomUUID)
export const conversationCacheStorage: CacheStorage = snapshot
