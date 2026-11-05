import { useEffect, type ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { applyPlatformTheme } from './platform'
import { theme, useTheme } from './useTheme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { ready, choice, dark } = useTheme()
  useEffect(() => { void theme.initialize(); return theme.listen() }, [])
  useEffect(() => { if (ready) applyPlatformTheme(choice, dark) }, [ready, choice, dark])
  return <><StatusBar style={dark ? 'light' : 'dark'} />{ready ? children : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0c1210' : '#f6f8f6' }}><ActivityIndicator accessibilityLabel="Loading appearance" /></View>}</>
}
