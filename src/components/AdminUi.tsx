/**
 * Reference shared pieces used by Administration and Approvals: Badge (shared/ui/Badge), PageHeader
 * (shared/components/PageHeader), SearchInput, the JM Select dropdown, small icon buttons and table cells.
 */
import { useState, type ReactNode } from 'react'
import { Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { glass, radius, shadow, useColors, type Colors } from '../ui'
import { isWide } from '../shared/shellLayout'
import { Icon, type IconName } from './Icon'

const web = Platform.OS === 'web'
const pointer = (off = false): ViewStyle => (web ? ({ cursor: off ? 'not-allowed' : 'pointer' } as ViewStyle) : {})

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'
export function toneColors(c: Colors, tone: Tone) {
  return {
    success: { bg: c.successSoft, fg: c.success }, warning: { bg: c.warningSoft, fg: c.warning }, danger: { bg: c.dangerSoft, fg: c.danger },
    info: { bg: c.infoSoft, fg: c.info }, neutral: { bg: c.neutral, fg: c.muted }, brand: { bg: c.successSoft, fg: c.brand },
  }[tone]
}

/** Solid tinted pill: rounded-full px-2 py-0.5 text-xs font-medium. */
export function Badge({ tone = 'neutral', mono = false, children }: { tone?: Tone; mono?: boolean; children: ReactNode }) {
  const c = useColors(); const t = toneColors(c, tone)
  return <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: t.bg }}>
    <Text numberOfLines={1} style={{ fontFamily: mono ? Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' }) : 'Inter_500Medium', fontWeight: mono ? '400' : '500', fontSize: mono ? 11 : 12, lineHeight: 16, color: t.fg }}>{children}</Text>
  </View>
}

/** Page title + subtitle + actions. On phones the top bar names the page, so only the actions stay (full width). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const c = useColors(); const wide = isWide(useWindowDimensions().width)
  if (!wide && !actions) return null
  return <View style={{ marginBottom: wide ? 20 : 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
    {wide && <View style={{ minWidth: 0, flexShrink: 1 }}>
      <Text accessibilityRole="header" style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 24, lineHeight: 32, letterSpacing: -0.3, color: c.text }}>{title}</Text>
      {!!subtitle && <Text style={{ marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>{subtitle}</Text>}
    </View>}
    {!!actions && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, ...(wide ? {} : { width: '100%' }) }}>{actions}</View>}
  </View>
}

/** h-10 search field with the magnifier inside and a clear button. */
export function SearchInput({ value, onChange, placeholder, accessibilityLabel, style }: { value: string; onChange: (v: string) => void; placeholder: string; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors(); const [focused, setFocused] = useState(false)
  return <View style={[{ justifyContent: 'center' }, style]}>
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, zIndex: 1 }}><Icon name="search" size={16} color={c.muted} /></View>
    <TextInput selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent" value={value} onChangeText={onChange} placeholder={placeholder} accessibilityLabel={accessibilityLabel ?? placeholder} placeholderTextColor={c.muted}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ height: 48, includeFontPadding: false, paddingVertical: 12, paddingLeft: 44, paddingRight: 44, paddingStart: 44, paddingEnd: 44, borderWidth: 1, borderRadius: radius.control, borderColor: focused ? c.brand : c.border, backgroundColor: web ? c.input : c.panel, color: c.text, fontFamily: 'Inter_400Regular', fontSize: web ? 14 : 16, ...(focused ? { boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.25)' } : {}), ...(web ? ({ outlineStyle: 'none' } as object) : {}) }} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} style={{ position: 'absolute', right: 8, padding: 4, borderRadius: 4, ...pointer() }}><Icon name="x" size={16} color={c.muted} /></Pressable>}
  </View>
}

/** The JM dropdown (reference shared/ui/Select): h-10 control with a chevron, a glass menu below. */
export function Select<T extends string>({ value, options, onChange, label, style }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors(); const [open, setOpen] = useState(false); const [hover, setHover] = useState(false)
  const current = options.find(([v]) => v === value)?.[1] ?? ''
  return <View style={[{ zIndex: open ? 20 : 1 }, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(v => !v)} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
      style={{ height: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: radius.control, borderColor: open ? c.brand : hover ? 'rgba(22,163,74,0.4)' : c.border, backgroundColor: web ? c.input : c.panel, ...pointer() }}>
      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: c.text }}>{current}</Text>
      <Icon name="down" size={16} color={c.muted} />
    </Pressable>
    {open && <View accessibilityRole="menu" style={[{ position: 'absolute', top: 44, left: 0, right: 0, padding: 4, borderWidth: 1, borderRadius: radius.card, minWidth: 160 }, glass(c, 4), { backgroundColor: c.dark ? '#111827' : '#ffffff' }]}>
      {options.map(([v, text]) => <MenuOption key={v} selected={v === value} text={text} onPress={() => { setOpen(false); if (v !== value) onChange(v) }} />)}
    </View>}
  </View>
}
function MenuOption({ selected, text, onPress }: { selected: boolean; text: string; onPress: () => void }) {
  const c = useColors(); const [hover, setHover] = useState(false)
  return <Pressable accessibilityRole="menuitem" accessibilityLabel={text} accessibilityState={{ selected }} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={{ minHeight: 36, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: hover ? c.hover : 'transparent', ...pointer() }}>
    <Text style={{ fontFamily: selected ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 14, color: c.text }}>{text}</Text>
    {selected && <Icon name="check" size={16} color={c.brand} />}
  </Pressable>
}

/** Reference Button with a leading lucide icon (sizes md h-10 / sm h-8). */
export function IconTextButton({ icon, title, onPress, accessibilityLabel, variant = 'primary', size = 'md', disabled = false, style }: { icon?: IconName; title: string; onPress: () => void; accessibilityLabel?: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors(); const [hover, setHover] = useState(false)
  const filled = variant === 'primary' || variant === 'danger'
  const bg = variant === 'primary' ? (hover ? c.primaryHover : c.primary) : variant === 'danger' ? c.danger : variant === 'secondary' ? (web ? c.glass2 : c.panel) : hover ? c.hover : 'transparent'
  const fg = filled ? '#ffffff' : c.text
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={({ pressed }) => [{ minHeight: size === 'sm' ? (web ? 32 : 36) : (web ? 40 : 44), paddingHorizontal: size === 'sm' ? 12 : 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.control, borderWidth: variant === 'secondary' ? 1 : 0, borderColor: variant === 'secondary' && hover ? 'rgba(22,163,74,0.4)' : c.border, backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], ...(filled ? { boxShadow: shadow.sm } : {}), ...pointer(disabled) }, style]}>
    {!!icon && <Icon name={icon} size={16} color={fg} />}
    <Text style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20, color: fg }}>{title}</Text>
  </Pressable>
}

/** Round muted icon button that turns red on hover (reference row delete: rounded-full p-2 text-muted hover:bg-danger/10). */
export function RowIconButton({ icon, label, onPress, danger = false, disabled = false }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const c = useColors(); const [hover, setHover] = useState(false)
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hover ? (danger ? 'rgba(220,38,38,0.1)' : c.hover) : 'transparent', opacity: disabled ? 0.4 : hover ? 1 : 0.75, ...pointer(disabled) }}>
    <Icon name={icon} size={16} color={hover && danger ? c.danger : c.muted} />
  </Pressable>
}

/** Pill tabs (reference Approvals filter / section switcher). */
export function PillTabs<T extends string>({ value, options, onChange, label, badge, horizontal = false }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string; badge?: Partial<Record<T, string>>; horizontal?: boolean }) {
  const c = useColors()
  const tabs = <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: horizontal ? 'nowrap' : 'wrap', gap: 6 }}>
    {options.map(([v, text]) => { const selected = v === value; const count = badge?.[v]; return <Pressable key={v} accessibilityRole="tab" accessibilityLabel={text} accessibilityState={{ selected }} aria-selected={selected} onPress={() => onChange(v)}
      style={({ pressed }) => ({ height: 32, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: selected ? c.primary : c.neutral, opacity: pressed ? 0.8 : 1, ...pointer() })}>
      <Text style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, color: selected ? '#ffffff' : c.muted }}>{text}</Text>
      {!!count && <View style={{ minWidth: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: c.brandFill, alignItems: 'center' }}><Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16, color: '#ffffff' }}>{count}</Text></View>}
    </Pressable> })}
  </View>
  return horizontal ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 3 }}>{tabs}</ScrollView> : tabs
}

/** Hover-tinted pressable row (reference hover:bg-black/[0.03] dark:hover:bg-white/[0.04]). */
export function HoverRow({ children, trailing, onPress, accessibilityLabel, style, first }: { children: ReactNode; trailing?: ReactNode; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle>; first?: boolean }) {
  const c = useColors(); const [hover, setHover] = useState(false)
  // The row's own action (trailing) sits beside the pressable area, never inside it (no nested buttons on web).
  return <View onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
    style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: first ? 0 : 1, borderTopColor: c.border, backgroundColor: hover && onPress ? (c.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)') : 'transparent' }}>
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={accessibilityLabel} onPress={onPress} disabled={!onPress}
      style={[{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', ...(onPress ? pointer() : {}) }, style]}>
      {children}
    </Pressable>
    {trailing}
  </View>
}

export const tableHead = (c: Colors) => ({ fontFamily: 'Inter_500Medium', fontWeight: '500' as const, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' as const, color: c.muted })
