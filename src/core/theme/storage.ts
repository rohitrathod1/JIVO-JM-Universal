import type { ThemeStorage } from './model'
const key = 'jm.theme'
export const themeStorage: ThemeStorage = {
  read: async () => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  write: async choice => {
    if (typeof window === 'undefined') return
    if (choice === 'system') window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, choice)
  },
  subscribe: listener => {
    if (typeof window === 'undefined') return () => {}
    const changed = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === key || event.key === null)) listener(event.key === null ? null : event.newValue)
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  },
}
