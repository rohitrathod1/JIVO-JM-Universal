import { useState, type ReactNode } from 'react'
import { Pressable, Text, View, useWindowDimensions } from 'react-native'
import { Surface, useColors } from '../ui'
import { Icon, type IconName } from './Icon'

/** Profile cards start collapsed; keeping the content mounted preserves unsaved edits. */
export function ProfileSection({ title, aside, badge, children }: { title: string; aside?: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  const c = useColors()
  const [expanded, setExpanded] = useState(false)
  return <Surface style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={expanded ? 'Collapse section' : 'Expand section'} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ flex: 1, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 24 }}>{title}</Text>
      {badge}
      <Icon name={expanded ? 'chevronUp' : 'down'} size={20} color={c.muted} />
    </Pressable>
    <View style={{ display: expanded ? 'flex' : 'none', paddingTop: 16, paddingBottom: 8 }}>
      {!!aside && <View style={{ alignItems: 'flex-start', marginBottom: 16 }}>{aside}</View>}
      {children}
    </View>
  </Surface>
}

/** Reference Badge: small rounded pill. */
export function Pill({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'info' }) {
  const c = useColors()
  const [bg, fg] = { neutral: [c.neutral, c.muted], brand: [c.soft, c.primary], success: [c.successSoft, c.success], warning: [c.warningSoft, c.warning], info: [c.infoSoft, c.info] }[tone]
  return <Text style={{ backgroundColor: bg, color: fg, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 12, lineHeight: 16, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', alignSelf: 'center' }}>{children}</Text>
}

/**
 * A settings row: icon, title and muted detail, actions at the end (reference TwoStepSection / AppSection rows).
 * `chip` draws the icon in a 36px soft green circle; otherwise a plain 20px icon in `tone`.
 */
export function SettingRow({ icon, title, detail, children, chip = false, tone, first = false }: { icon: IconName; title: ReactNode; detail?: ReactNode; children?: ReactNode; chip?: boolean; tone?: string; first?: boolean }) {
  const c = useColors(); const { width } = useWindowDimensions(); const phone = width < 640
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: chip ? 'flex-start' : 'center', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderColor: c.border }}>
    {chip ? <View style={{ width: 36, height: 36, marginTop: 2, borderRadius: 18, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color={c.brand} /></View>
      : <Icon name={icon} size={20} color={tone ?? c.muted} />}
    <View style={{ flex: 1, minWidth: 160 }}>
      {typeof title === 'string' ? <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{title}</Text> : title}
      {typeof detail === 'string' ? <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{detail}</Text> : detail}
    </View>
    {!!children && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, ...(phone ? { width: '100%', justifyContent: 'flex-end', paddingLeft: chip ? 48 : 32 } : null) }}>{children}</View>}
  </View>
}

export const mutedText = (color: string) => ({ fontFamily: 'Inter_400Regular', color, fontSize: 12, lineHeight: 16 }) as const
