import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, StyleSheet, useWindowDimensions, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native'
import { useState } from 'react'
import { useTheme } from './core/theme/useTheme'
import { controlHeight, isWide } from './shared/shellLayout'
import type { ReactNode } from 'react'
// Reference tokens from Frontend/src/index.css. Solid glass fallback keeps native data readable;
// web uses the reference translucent glass levels with backdrop blur (see `glass()`).
export const palette = {
  light: {
    dark: false, bg: '#f6f8f6', panel: '#ffffff', shell: '#f6f9f7', text: '#0f172a', muted: '#475569', subtle: '#e2e8f0', border: 'rgba(15,23,42,0.1)', ring: '#16a34a',
    primary: '#15803d', primaryHover: '#166534', brand: '#16a34a', gold: '#e8a317', soft: '#dcfce7', neutral: '#f1f5f9', chat: '#f2eee9', outgoing: '#d9fdd3', incoming: '#ffffff',
    danger: '#b91c1c', dangerSoft: '#fee2e2', success: '#15803d', successSoft: '#dcfce7', warning: '#b45309', warningSoft: '#fef3c7', info: '#1d4ed8', infoSoft: '#dbeafe',
    glass1: 'rgba(255,255,255,0.55)', glass1Border: 'rgba(255,255,255,0.45)', glass2: 'rgba(255,255,255,0.68)', glass2Border: 'rgba(255,255,255,0.55)', glass3: 'rgba(255,255,255,0.9)', glass4: 'rgba(255,255,255,0.86)', glass4Border: 'rgba(255,255,255,0.6)',
    input: 'rgba(255,255,255,0.9)', hover: 'rgba(0,0,0,0.05)',
  },
  dark: {
    dark: true, bg: '#0c1210', panel: '#1e293b', shell: '#111c22', text: '#f1f5f9', muted: '#cbd5e1', subtle: '#1e293b', border: 'rgba(255,255,255,0.1)', ring: '#22c55e',
    primary: '#16a34a', primaryHover: '#15803d', brand: '#22c55e', gold: '#f0b429', soft: '#163828', neutral: '#263340', chat: '#0b111c', outgoing: '#144d37', incoming: '#1e293b',
    danger: '#f87171', dangerSoft: '#42252b', success: '#4ade80', successSoft: 'rgba(34,197,94,0.16)', warning: '#fbbf24', warningSoft: 'rgba(245,158,11,0.16)', info: '#93c5fd', infoSoft: 'rgba(59,130,246,0.16)',
    glass1: 'rgba(15,23,42,0.55)', glass1Border: 'rgba(255,255,255,0.08)', glass2: 'rgba(30,41,59,0.6)', glass2Border: 'rgba(255,255,255,0.1)', glass3: 'rgba(15,23,42,0.86)', glass4: 'rgba(17,24,39,0.9)', glass4Border: 'rgba(255,255,255,0.1)',
    input: 'rgba(15,23,42,0.7)', hover: 'rgba(255,255,255,0.1)',
  },
} as const
export type Colors = (typeof palette)['light'] | (typeof palette)['dark']
export function useColors(): Colors { return palette[useTheme().dark ? 'dark' : 'light'] }

const web = Platform.OS === 'web'
/** Reference radii: 16px panels, 12px inner cards, 10px inputs/buttons. */
export const radius = { panel: 16, card: 12, control: 10 } as const
/** Reference shadows (`--shadow-card`, `--shadow-overlay`); `boxShadow` works on web and the new architecture. */
export const shadow = { card: '0 8px 32px rgba(15, 23, 42, 0.08)', overlay: '0 16px 48px rgba(15, 23, 42, 0.18)', sm: '0 1px 2px rgba(15, 23, 42, 0.05)' } as const

/**
 * The four reference glass levels: 1 shell bars, 2 cards and tiles, 3 data surfaces, 4 overlays.
 * Native has no backdrop blur here, so it uses the solid fallback colours (reference `prefers-reduced-transparency`).
 */
export function glass(c: Colors, level: 1 | 2 | 3 | 4): ViewStyle {
  if (!web) return level === 1 ? { backgroundColor: c.shell, borderColor: c.border } : { backgroundColor: c.panel, borderColor: c.border, ...(level === 2 || level === 4 ? { boxShadow: level === 4 ? shadow.overlay : shadow.card } : {}) }
  const blur = { 1: 'blur(20px) saturate(160%)', 2: 'blur(16px) saturate(150%)', 3: 'blur(12px)', 4: 'blur(24px) saturate(180%)' }[level]
  const background = { 1: c.glass1, 2: c.glass2, 3: c.glass3, 4: c.glass4 }[level]
  const border = { 1: c.glass1Border, 2: c.glass2Border, 3: c.border, 4: c.glass4Border }[level]
  return { backgroundColor: background, borderColor: border, ...(level === 2 ? { boxShadow: shadow.card } : level === 4 ? { boxShadow: shadow.overlay } : {}), ...({ backdropFilter: blur, WebkitBackdropFilter: blur } as ViewStyle) }
}

/** Reference: anything clickable shows the hand cursor; disabled shows not-allowed. Web only. */
const cursor = (disabled: boolean): ViewStyle => (web ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle) : {})

export function Label({ children, large = false }: { children: ReactNode; large?: boolean }) {
  const c = useColors(); const { width } = useWindowDimensions()
  // Reference page title: text-xl font-semibold tracking-tight, md:text-2xl.
  const size = large ? (isWide(width) ? 24 : 20) : 15
  return <Text style={{ fontFamily: large ? 'Inter_600SemiBold' : 'Inter_400Regular', color: c.text, fontSize: size, fontWeight: large ? '600' : '400', lineHeight: large ? (size === 24 ? 32 : 28) : 22, letterSpacing: large ? -0.3 : 0 }}>{children}</Text>
}
export function Button({ title, onPress, disabled = false, loading = false, accessibilityLabel, variant = 'primary', size = 'md', style }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; accessibilityLabel?: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  const c = useColors(); const [hovered, setHovered] = useState(false)
  const off = disabled || loading
  const filled = variant === 'primary' || variant === 'danger'
  const background = variant === 'primary' ? (hovered ? c.primaryHover : c.primary) : variant === 'danger' ? c.danger : variant === 'secondary' ? (web ? c.glass2 : c.panel) : hovered ? c.hover : 'transparent'
  const height = size === 'sm' ? (web ? 32 : 36) : controlHeight(Platform.OS)
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: off, busy: loading }} disabled={off} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    style={({ pressed }) => [{ paddingHorizontal: size === 'sm' ? 12 : 16, minHeight: height, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, borderWidth: variant === 'secondary' ? 1 : 0, borderColor: variant === 'secondary' && hovered ? 'rgba(22,163,74,0.4)' : c.border, backgroundColor: background, opacity: off ? 0.5 : pressed ? 0.85 : variant === 'danger' && hovered ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], ...(filled ? { boxShadow: shadow.sm } : {}), ...cursor(off) }, style]}>
    {loading && <ActivityIndicator size="small" color={filled ? '#ffffff' : c.brand} />}
    <Text style={{ fontFamily: 'Inter_500Medium', color: filled ? '#ffffff' : c.text, fontWeight: '500', textAlign: 'center', fontSize: 14, lineHeight: 20 }}>{title}</Text>
  </Pressable>
}
export function Field({ label, compact, hint, error, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; compact?: boolean; hint?: string; error?: string }) {
  const c = useColors(); const [focused, setFocused] = useState(false)
  return <View style={{ gap: 6 }}>{!compact && <Text style={{ fontFamily: 'Inter_500Medium', color: c.text, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{label}</Text>}<TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label} aria-invalid={error ? true : undefined}
    onFocus={event => { setFocused(true); onFocus?.(event) }} onBlur={event => { setFocused(false); onBlur?.(event) }}
    placeholderTextColor={c.muted} style={[{ fontFamily: 'Inter_400Regular', fontSize: web ? 14 : 16, paddingHorizontal: 12, paddingVertical: 8, minHeight: controlHeight(Platform.OS), borderWidth: 1, borderRadius: radius.control, borderColor: error ? c.danger : focused ? c.brand : c.border, color: c.text, backgroundColor: web ? c.input : c.panel, opacity: props.editable === false ? 0.6 : 1, ...(focused ? { boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.25)' } : {}), ...(web ? ({ outlineStyle: 'none' } as object) : {}) }, style]} />
    {error ? <Text accessibilityRole={web ? 'alert' : undefined} style={{ fontFamily: 'Inter_400Regular', color: c.danger, fontSize: 12, lineHeight: 16 }}>{error}</Text>
      : hint ? <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 12, lineHeight: 16 }}>{hint}</Text> : null}</View>
}
/** Level-2 glass card, 16px radius (reference shared/ui/Card). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  return <View style={[{ padding: 16, borderWidth: 1, borderRadius: radius.panel, gap: 12 }, glass(c, 2), style]}>{children}</View>
}
/** Level-3 data surface (tables, forms), 16px radius (reference shared/ui/Card `Surface`). */
export function Surface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  return <View style={[{ borderWidth: 1, borderRadius: radius.panel, overflow: 'hidden' }, glass(c, 3), style]}>{children}</View>
}
/** Reference Spinner: a 20px brand-coloured loader with a status label. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  const c = useColors()
  return <ActivityIndicator accessibilityLabel={label} color={c.brand} />
}
/** Reference EmptyState: centred title, optional description and action. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  const c = useColors()
  return <View style={{ alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 48 }}>
    <Text style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', color: c.text, fontSize: 15, textAlign: 'center' }}>{title}</Text>
    {!!description && <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 384 }}>{description}</Text>}
    {!!action && <View style={{ marginTop: 8 }}>{action}</View>}
  </View>
}
/** Reference DataState error: danger text and a small secondary "Try again". */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useColors()
  return <View accessibilityRole={web ? 'alert' : undefined} style={{ alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 40 }}>
    <Text style={{ fontFamily: 'Inter_400Regular', color: c.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{message}</Text>
    {onRetry && <Button variant="secondary" size="sm" title="Try again" onPress={onRetry} />}
  </View>
}
// Phone values of the reference page padding (16px gutter); Workspace adds the desktop difference (32px).
export const styles = StyleSheet.create({ page: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 18 }, row: { flexDirection: 'row', gap: 12, alignItems: 'center' } })
