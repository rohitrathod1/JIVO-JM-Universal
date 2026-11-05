import { Appearance } from 'react-native'
import type { ThemeChoice } from './model'
export function applyPlatformTheme(choice: ThemeChoice, _dark: boolean) {
  Appearance.setColorScheme(choice === 'system' ? 'auto' : choice)
}
