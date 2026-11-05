// Reference-matched building blocks for the Notifications and Passwords pages (reference PageHeader, tab rows,
// JpNav pills, Select, Badge, list rows). Plain React Native styles; web-only cursor/outline guarded by Platform.
import { useState, type ReactNode } from 'react'
import { Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native'
import { radius, shadow, useColors, glass } from '../ui'
import { isWide } from '../shared/shellLayout'
import { Icon, type IconName } from './Icon'
type PSt = PressableStateCallbackType & { hovered?: boolean }

const web = Platform.OS === 'web'
const pointer = (off = false): ViewStyle => (web ? ({ cursor: off ? 'not-allowed' : 'pointer' } as ViewStyle) : {})
export const font = { r: 'Inter_400Regular', m: 'Inter_500Medium', s: 'Inter_600SemiBold' } as const

/** Reference PageHeader: text-xl/2xl title, muted subtitle; title hidden on phones (the top bar names the page). */
export function PageHeader({ title, subtitle, actions, crumbs, showMobileCrumbs = false }: { title: string; showMobileCrumbs?: boolean; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { label: string; onPress?: () => void }[] }) {
  const c = useColors(); const { width } = useWindowDimensions(); const wide = isWide(width)
  return <View style={{ gap: 0 }}>
    {!!crumbs?.length && (wide || showMobileCrumbs) && <View accessibilityRole={web ? ('navigation' as never) : undefined} aria-label="Breadcrumb" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 16, paddingLeft: 4 }}>
      {crumbs.map((crumb, i) => { const last = i === crumbs.length - 1; return <View key={crumb.label + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {i > 0 && <View style={{ marginHorizontal: 2 }}><Icon name="chevronRight" size={14} color={c.muted} /></View>}
        {crumb.onPress && !last ? <Pressable accessibilityRole="link" onPress={crumb.onPress} style={pointer()}>{({ hovered }: PSt) => <Text style={{ fontFamily: font.r, fontSize: 14, color: hovered ? c.text : c.muted }}>{crumb.label}</Text>}</Pressable>
          : <Text style={{ fontFamily: last ? font.m : font.r, fontWeight: last ? '500' : '400', fontSize: 14, color: last ? c.text : c.muted }}>{crumb.label}</Text>}
      </View> })}
    </View>}
    {(wide || actions) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: wide ? 20 : 16 }}>
      {wide && <View style={{ minWidth: 0, flexShrink: 1 }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.s, fontWeight: '600', fontSize: 24, lineHeight: 32, letterSpacing: -0.4, color: c.text }}>{title}</Text>
        {!!subtitle && <Text style={{ fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.muted, marginTop: 4 }}>{subtitle}</Text>}
      </View>}
      {actions && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, ...(wide ? {} : { width: '100%' }) }}>{actions}</View>}
    </View>}
  </View>
}

/** Reference underline tabs: border-b, active tab has a 2px brand underline and fg text, others muted. */
export function UnderlineTabs<T extends string>({ tabs, value, onChange, label, compact = false, asButtons = false, scrollable = false }: { tabs: { value: T; label: string; accessibilityLabel?: string }[]; value: T; onChange: (value: T) => void; label: string; compact?: boolean; asButtons?: boolean; scrollable?: boolean }) {
  const c = useColors()
  const row = <View accessibilityRole={asButtons ? undefined : 'tablist'} aria-label={label} style={{ flexDirection: 'row', gap: compact ? 0 : 4, borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: compact ? 0 : 16 }}>
    {tabs.map(t => { const on = t.value === value; return <Pressable key={t.value} accessibilityRole={asButtons ? 'button' : 'tab'} accessibilityLabel={t.accessibilityLabel ?? t.label} accessibilityState={{ selected: on }} aria-selected={asButtons ? undefined : on} onPress={() => onChange(t.value)} style={[{ marginBottom: -1, borderBottomWidth: 2, borderBottomColor: on ? c.brand : 'transparent', paddingHorizontal: compact ? 4 : 16, marginRight: compact ? 20 : 0, paddingVertical: 8 }, pointer()]}>
      {({ hovered }: PSt) => <Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: on || hovered ? c.text : c.muted }}>{t.label}</Text>}
    </Pressable> })}
  </View>
  return scrollable ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ minWidth: '100%' }}>{row}</ScrollView> : row
}

/** Reference JpNav pills: rounded-full, active = brand fill + white text, others bordered muted. */
export function PillTabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: string; accessibilityLabel?: string }[]; value: T; onChange: (value: T) => void; label: string }) {
  const c = useColors()
  return <View aria-label={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
    {tabs.map(t => { const on = t.value === value; return <Pressable key={t.value} accessibilityRole="button" accessibilityLabel={t.accessibilityLabel ?? t.label} accessibilityState={{ selected: on }} onPress={() => onChange(t.value)}
      style={({ hovered }: PSt) => [{ borderRadius: 999, borderWidth: 1, borderColor: on ? c.brand : hovered ? 'rgba(22,163,74,0.4)' : c.border, backgroundColor: on ? c.brand : 'transparent', paddingHorizontal: 14, paddingVertical: 6, ...(on ? { boxShadow: shadow.sm } : {}) }, pointer()]}>
      {({ hovered }: PSt) => <Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: on ? '#ffffff' : hovered ? c.text : c.muted }}>{t.label}</Text>}
    </Pressable> })}
  </View>
}

/** Reference Select: h-9/h-10 bordered control with a chevron; opens a small option list below it. */
export function Select<T extends string>({ value, options, onChange, label, style, height = 36, disabled = false }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string; style?: StyleProp<ViewStyle>; height?: number; disabled?: boolean }) {
  const c = useColors(); const [open, setOpen] = useState(false); const current = options.find(o => o.value === value)
  return <View style={[{ position: 'relative', zIndex: open ? 50 : 1 }, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={current?.label} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(v => !v)}
      style={({ hovered }: PSt) => [{ height, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 12, paddingRight: 10, borderWidth: 1, borderRadius: radius.control, borderColor: open || hovered ? c.brand : c.border, backgroundColor: web ? c.input : c.panel, opacity: disabled ? 0.6 : 1 }, pointer(disabled)]}>
      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.r, fontSize: 14, color: c.text }}>{current?.label ?? ''}</Text>
      <Icon name="down" size={16} color={c.muted} />
    </Pressable>
    {open && <View accessibilityRole="menu" style={[{ position: 'absolute', top: height + 4, left: 0, minWidth: '100%', borderWidth: 1, borderRadius: radius.card, paddingVertical: 4, zIndex: 60 }, glass(c, 4), web ? {} : { backgroundColor: c.panel }]}>
      {options.map(o => <Pressable key={o.value} accessibilityRole="menuitem" accessibilityLabel={o.label} accessibilityState={{ selected: o.value === value }} onPress={() => { setOpen(false); onChange(o.value) }}
        style={({ hovered }: PSt) => [{ paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: hovered ? c.hover : 'transparent' }, pointer()]}>
        <View style={{ width: 16 }}>{o.value === value && <Icon name="check" size={14} color={c.brand} />}</View>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: o.value === value ? font.m : font.r, fontWeight: o.value === value ? '500' : '400', fontSize: 14, color: c.text }}>{o.label}</Text>
      </Pressable>)}
    </View>}
  </View>
}

/** Reference Badge: rounded-full text-xs; tones brand / neutral / danger / warning / info. */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'brand' | 'neutral' | 'danger' | 'warning' | 'info' }) {
  const c = useColors()
  const [bg, fg] = tone === 'brand' ? [c.soft, c.primary] : tone === 'danger' ? [c.dangerSoft, c.danger] : tone === 'warning' ? [c.warningSoft, c.warning] : tone === 'info' ? [c.infoSoft, c.info] : [c.neutral, c.muted]
  return <View style={{ borderRadius: 999, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: 12, lineHeight: 16, color: fg }}>{children}</Text></View>
}

/** Reference secondary/ghost button with a leading lucide icon. `label` is the visible text; `a11y` the accessible name. */
export function ToolButton({ icon, label, a11y, onPress, variant = 'secondary', disabled = false, iconOnly = false, danger = false, muted = false, height = 36 }: { icon?: IconName; label: string; a11y?: string; onPress: () => void; variant?: 'secondary' | 'ghost' | 'primary'; disabled?: boolean; iconOnly?: boolean; danger?: boolean; muted?: boolean; height?: number }) {
  const c = useColors(); const fg = variant === 'primary' ? '#ffffff' : danger ? c.danger : muted ? c.muted : c.text
  return <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ hovered, pressed }: PSt) => [{ height, minWidth: height, paddingHorizontal: iconOnly ? 0 : 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.control, borderWidth: variant === 'secondary' ? 1 : 0, borderColor: hovered ? (danger ? 'rgba(185,28,28,0.5)' : 'rgba(22,163,74,0.4)') : c.border, backgroundColor: variant === 'primary' ? (hovered ? c.primaryHover : c.primary) : variant === 'secondary' ? (web ? c.input : c.panel) : hovered ? c.hover : 'transparent', opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], ...(variant === 'primary' ? { boxShadow: shadow.sm } : {}) }, pointer(disabled)]}>
    {icon && <Icon name={icon} size={16} color={fg} />}
    {!iconOnly && <Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: muted ? 18 : 14, lineHeight: 20, color: fg }}>{label}</Text>}
  </Pressable>
}

/** Reference SearchInput: 40px control with a leading search icon. */
export function SearchInput({ value, onChangeText, placeholder, label, style }: { value: string; onChangeText: (v: string) => void; placeholder: string; label: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors(); const [focused, setFocused] = useState(false)
  return <View style={[{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderWidth: 1, borderRadius: radius.control, borderColor: focused ? c.brand : c.border, backgroundColor: web ? c.input : c.panel, ...(focused ? { boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.25)' } : {}) }, style]}>
    <Icon name="search" size={16} color={c.muted} />
    <TextInput selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent" accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.muted} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoCapitalize="none"
      style={{ flex: 1, minWidth: 0, height: 46, paddingHorizontal: 0, paddingVertical: 12, includeFontPadding: false, fontFamily: font.r, fontSize: web ? 14 : 16, color: c.text, ...(web ? ({ outlineStyle: 'none' } as object) : {}) }} />
  </View>
}

/** A full-width list row with the reference hover tint (`hover:bg-black/[0.03]`). */
export function RowButton({ label, onPress, children, style }: { label: string; onPress: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ hovered, pressed }: PSt) => [{ backgroundColor: hovered || pressed ? (c.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)') : 'transparent' }, pointer(), style]}>{children}</Pressable>
}

export function Muted({ children, size = 12, lines }: { children: ReactNode; size?: number; lines?: number }) {
  const c = useColors()
  return <Text numberOfLines={lines} style={{ fontFamily: font.r, fontSize: size, lineHeight: size === 12 ? 16 : 20, color: c.muted }}>{children}</Text>
}

/** Reference `formatRelative`: "just now", "5 min ago", "2 h ago", "yesterday", else dd-Mon-yyyy. */
export function relative(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '—'
  const t = Date.parse(iso); if (!Number.isFinite(t)) return '—'
  const s = Math.round((now - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  const d = new Date(t); const today = new Date(now)
  if (d.toDateString() === today.toDateString()) return `${Math.floor(s / 3600)} h ago`
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'yesterday'
  return dateLabel(iso)
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function dateLabel(iso: string, time = false) {
  const d = new Date(iso); const date = `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
  return time ? `${date}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : date
}

export const SEVERITY_LABEL: Record<string, string> = { info: 'Information', warning: 'Warning', critical: 'Critical' }
/** Reference SeverityIcon chip: 24px round, tinted border and background. */
export function SeverityDot({ severity }: { severity: string }) {
  const c = useColors()
  const [bg, fg, border] = severity === 'critical' ? [c.dangerSoft, c.danger, 'rgba(220,38,38,0.3)'] : severity === 'warning' ? [c.warningSoft, c.warning, 'rgba(217,119,6,0.3)'] : [c.infoSoft, c.info, 'rgba(37,99,235,0.3)']
  return <View accessibilityLabel={SEVERITY_LABEL[severity]} style={{ marginTop: 2, width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={severity === 'info' ? 'info' : severity === 'warning' ? 'alertTriangle' : 'megaphone'} size={14} color={fg} /></View>
}
