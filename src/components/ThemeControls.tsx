import { Pressable, Text, View } from 'react-native'
import { Card, Label, useColors } from '../ui'
import { useTheme } from '../core/theme/useTheme'
import { Icon, type IconName } from './Icon'
import type { ThemeChoice } from '../core/theme/model'

/** Same one-tap opposite-theme action as the reference. System remains the default. */
export function ThemeToggle({ label = false }: { label?: boolean }) {
  const { dark, set } = useTheme(); const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'} onPress={() => void set(dark ? 'light' : 'dark')}
    style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6, borderRadius: 12, backgroundColor: pressed ? c.neutral : 'transparent' })}>
    <Icon name={dark ? 'sun' : 'moon'} size={22} />
    {label && <Text style={{ fontFamily: 'Inter_600SemiBold', color: c.muted, fontSize: 10 }}>{dark ? 'Light' : 'Dark'}</Text>}
  </Pressable>
}

const choices: { value: ThemeChoice; title: string; icon: IconName }[] = [
  { value: 'light', title: 'Light', icon: 'sun' }, { value: 'dark', title: 'Dark', icon: 'moon' }, { value: 'system', title: 'Device', icon: 'system' },
]
export function ThemeSettings() {
  const { choice, notice, set } = useTheme(); const c = useColors()
  return <Card><Label large>Appearance</Label><Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>Choose a theme for this device. Device follows your system setting.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{choices.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={item.value === 'system' ? 'Use device theme' : `${item.title} theme`} accessibilityState={{ checked: choice === item.value }} onPress={() => void set(item.value)}
      style={{ flex: 1, minWidth: 80, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: choice === item.value ? c.brand : c.border, backgroundColor: choice === item.value ? c.soft : c.panel }}><Icon name={item.icon} color={choice === item.value ? c.primary : c.muted} /><Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{item.title}</Text></Pressable>)}</View>
    {!!notice && <Text accessibilityRole="alert" style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{notice}</Text>}
  </Card>
}
