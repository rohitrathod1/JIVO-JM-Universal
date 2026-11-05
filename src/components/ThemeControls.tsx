import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useColors } from '../ui'
import { touchBox } from '../shared/shellLayout'
import { ProfileSection } from './ProfileSection'
import { useTheme } from '../core/theme/useTheme'
import { Icon, type IconName } from './Icon'
import type { ThemeChoice } from '../core/theme/model'

/** Same one-tap opposite-theme action as the reference. System remains the default. */
export function ThemeToggle({ label = false, prominent = false }: { label?: boolean; prominent?: boolean }) {
  const { dark, set } = useTheme(); const c = useColors(); const { width } = useWindowDimensions()
  // DEF-005: the bare 36px icon gets a transparent 44px phone hit box; the hover/press circle stays 36px.
  if (!label && !prominent) return <Pressable accessibilityRole="button" accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'} onPress={() => void set(dark ? 'light' : 'dark')}
    style={{ ...touchBox(36, width), ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : {}) }}>
    {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: pressed || hovered ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }}><Icon name={dark ? 'sun' : 'moon'} size={20} /></View>}
  </Pressable>
  return <Pressable accessibilityRole="button" accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'} onPress={() => void set(dark ? 'light' : 'dark')}
    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ minWidth: label || prominent ? 44 : 36, minHeight: label || prominent ? 44 : 36, flexDirection: prominent ? 'row' : 'column', borderWidth: prominent ? 1 : 0, borderColor: c.border, alignItems: 'center', justifyContent: 'center', gap: prominent ? 8 : 4, padding: label ? 6 : 8, paddingHorizontal: prominent ? 14 : 8, borderRadius: label ? 12 : 999, backgroundColor: pressed || hovered ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : prominent ? c.panel : 'transparent', ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : {}) })}>
    <Icon name={dark ? 'sun' : 'moon'} size={label ? 22 : 20} />
    {prominent && <Text style={{ fontFamily: 'Inter_500Medium', color: c.text, fontSize: 14 }}>{dark ? 'Light mode' : 'Dark mode'}</Text>}
    {label && <Text style={{ fontFamily: 'Inter_600SemiBold', color: c.muted, fontSize: 10 }}>{dark ? 'Light' : 'Dark'}</Text>}
  </Pressable>
}

const choices: { value: ThemeChoice; title: string; icon: IconName }[] = [
  { value: 'light', title: 'Light', icon: 'sun' }, { value: 'dark', title: 'Dark', icon: 'moon' }, { value: 'system', title: 'Device', icon: 'system' },
]
export function ThemeSettings() {
  const { choice, notice, set } = useTheme(); const c = useColors()
  return <ProfileSection title="Appearance"><Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20, marginTop: -8, marginBottom: 12 }}>Choose a theme for this device. Device follows your system setting.</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: c.neutral, alignSelf: 'flex-start', maxWidth: '100%' }}>{choices.map(item => { const on = choice === item.value; return <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={item.value === 'system' ? 'Use device theme' : `${item.title} theme`} aria-checked={on} accessibilityState={{ checked: on }} onPress={() => void set(item.value)}
      style={({ pressed }) => ({ flexDirection: 'row', minHeight: 32, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, backgroundColor: on ? c.panel : pressed ? c.hover : 'transparent', ...(on ? { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)' } : null), ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null) })}><Icon name={item.icon} size={16} color={on ? c.primary : c.muted} /><Text style={{ color: on ? c.text : c.muted, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14 }}>{item.title}</Text></Pressable> })}</View>
    {!!notice && <Text accessibilityRole="alert" style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }}>{notice}</Text>}
  </ProfileSection>
}
