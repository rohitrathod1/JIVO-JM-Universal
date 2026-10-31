import { Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native'
import { useSystemColorScheme } from './shared/useSystemColorScheme'
import type { ReactNode } from 'react'
export function useColors() {
  return useSystemColorScheme() === 'dark'
    ? { bg: '#0b1510', panel: '#14251b', text: '#edf6ef', muted: '#a2b7a7', border: '#2d4434', primary: '#15803D' }
    : { bg: '#f3f7f4', panel: '#ffffff', text: '#16291d', muted: '#627367', border: '#dce7df', primary: '#15803D' }
}
export function Label({ children, large = false }: { children: ReactNode; large?: boolean }) {
  const c = useColors()
  return <Text style={{ fontFamily: large ? 'Inter_700Bold' : 'Inter_400Regular', color: c.text, fontSize: large ? 26 : 16, fontWeight: large ? '700' : '400', lineHeight: large ? 34 : 24 }}>{children}</Text>
}
export function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ padding: 12, minHeight: 46, borderRadius: 12, backgroundColor: c.primary, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}>
    <Text style={{ fontFamily: 'Inter_600SemiBold', color: 'white', fontWeight: '600', textAlign: 'center', fontSize: 15 }}>{title}</Text>
  </Pressable>
}
export function Field(props: TextInputProps & { label: string; compact?: boolean }) {
  const c = useColors()
  return <View style={{ gap: 6 }}>{!props.compact && <Label>{props.label}</Label>}<TextInput {...props} accessibilityLabel={props.label}
    placeholderTextColor={c.muted} style={[{ fontFamily: 'Inter_400Regular', fontSize: 16, padding: 12, minHeight: 48, borderWidth: 1, borderRadius: 10, borderColor: c.border, color: c.text, backgroundColor: c.panel }, props.style]} /></View>
}
export function Card({ children }: { children: ReactNode }) {
  const c = useColors()
  return <View style={{ padding: 18, borderWidth: 1, borderRadius: 16, borderColor: c.border, backgroundColor: c.panel, gap: 12 }}>{children}</View>
}
export const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 20, gap: 18 }, row: { flexDirection: 'row', gap: 12, alignItems: 'center' } })


