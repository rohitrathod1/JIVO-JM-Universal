import * as SecureStore from 'expo-secure-store'
import type { ThemeStorage } from './model'
const key = 'jm.theme'
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
export const themeStorage: ThemeStorage = {
  read: () => SecureStore.getItemAsync(key, options),
  write: choice => choice === 'system' ? SecureStore.deleteItemAsync(key, options) : SecureStore.setItemAsync(key, choice, options),
}
