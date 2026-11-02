import type { ThemeChoice } from './model'
export function applyPlatformTheme(_choice: ThemeChoice, dark: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0C1210' : '#F6F8F6')
}
