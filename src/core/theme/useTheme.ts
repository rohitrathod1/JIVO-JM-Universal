import { useSyncExternalStore } from 'react'
import { useSystemColorScheme } from '../../shared/useSystemColorScheme'
import { initialTheme, isDarkTheme, ThemeController } from './model'
import { themeStorage } from './storage'
export const theme = new ThemeController(themeStorage)
export function useTheme() {
  const state = useSyncExternalStore(theme.subscribe, theme.snapshot, () => initialTheme)
  const system = useSystemColorScheme()
  return { ...state, dark: isDarkTheme(state.choice, system), set: theme.set }
}
