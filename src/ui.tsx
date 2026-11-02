import { Pressable, Text, TextInput, View, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native'
import { useState } from 'react'
import { useTheme } from './core/theme/useTheme'
import type { ReactNode } from 'react'
// Reference tokens from Frontend/src/index.css. Solid glass fallback keeps native data readable.
export const palette = {
  light: { dark: false, bg: '#f6f8f6', panel: '#ffffff', shell: '#f6f9f7', text: '#0f172a', muted: '#475569', border: 'rgba(15,23,42,0.1)', primary: '#15803d', brand: '#16a34a', gold: '#e8a317', soft: '#dcfce7', neutral: '#f1f5f9', chat: '#f2eee9', outgoing: '#d9fdd3', incoming: '#ffffff', danger: '#b91c1c', dangerSoft: '#fee2e2' },
  dark: { dark: true, bg: '#0c1210', panel: '#1e293b', shell: '#111c22', text: '#f1f5f9', muted: '#cbd5e1', border: 'rgba(255,255,255,0.1)', primary: '#16a34a', brand: '#22c55e', gold: '#f0b429', soft: '#163828', neutral: '#263340', chat: '#0b111c', outgoing: '#144d37', incoming: '#1e293b', danger: '#f87171', dangerSoft: '#42252b' },
} as const
export function useColors() { return palette[useTheme().dark ? 'dark' : 'light'] }
export function Label({ children, large = false }: { children: ReactNode; large?: boolean }) {
  const c = useColors()
  return <Text style={{ fontFamily: large ? 'Inter_600SemiBold' : 'Inter_400Regular', color: c.text, fontSize: large ? 20 : 15, fontWeight: large ? '600' : '400', lineHeight: large ? 28 : 22 }}>{children}</Text>
}
export function Button({ title, onPress, disabled = false, accessibilityLabel, variant = 'primary', style }: { title: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string; variant?: 'primary' | 'secondary' | 'ghost'; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [{ paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center', borderRadius: 10, borderWidth: variant === 'secondary' ? 1 : 0, borderColor: c.border, backgroundColor: variant === 'primary' ? c.primary : variant === 'secondary' ? c.panel : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }, style]}>
    <Text style={{ fontFamily: 'Inter_600SemiBold', color: variant === 'primary' ? 'white' : c.text, fontWeight: '600', textAlign: 'center', fontSize: 14, lineHeight: 20 }}>{title}</Text>
  </Pressable>
}
export function Field({ label, compact, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; compact?: boolean }) {
  const c = useColors(); const [focused, setFocused] = useState(false)
  return <View style={{ gap: 6 }}>{!compact && <Text style={{ fontFamily: 'Inter_500Medium', color: c.text, fontSize: 14, lineHeight: 20 }}>{label}</Text>}<TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label}
    onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
    placeholderTextColor={c.muted} style={[{ fontFamily: 'Inter_400Regular', fontSize: 16, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, borderWidth: 1, borderRadius: 10, borderColor: focused ? c.brand : c.border, color: c.text, backgroundColor: c.panel }, style]} /></View>
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  return <View style={[{ padding: 16, borderWidth: 1, borderRadius: 16, borderColor: c.border, backgroundColor: c.panel, gap: 12 }, style]}>{children}</View>
}
export const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 20, gap: 18 }, row: { flexDirection: 'row', gap: 12, alignItems: 'center' } })


