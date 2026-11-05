import { useState } from 'react'
import { Link, type Href } from 'expo-router'
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native'
import { Workspace } from '../components/Workspace'
import { useSession } from '../core/auth/Session'
import { homeTiles } from '../shared/homeTiles'
import { greeting } from '../shared/authNavigation'
import { Icon, type IconName } from '../components/Icon'
import { glass, radius, useColors } from '../ui'

// Reference HomePage (Frontend modules/home/pages/HomePage.tsx): same icons, copy and grid.
const icons: Record<string, IconName> = { Messenger: 'messagesSquare', Passwords: 'key', 'Profile & security': 'shieldCheck', People: 'users', 'Permission groups': 'shieldCheck', Security: 'lockKeyhole', Alerts: 'megaphone', 'Team vaults': 'vault', 'Emergency access': 'lifeBuoy' }
const descriptions: Record<string, string> = {
  Messenger: 'Chats and groups with anyone across JIVO.', Passwords: 'Shared team passwords, kept encrypted.', 'Profile & security': 'Your details, passkeys, password and signed-in devices.',
  People: 'Accounts, invitations and access.', 'Permission groups': 'What each group allows.', Security: 'Two-step verification for everyone.', Alerts: 'Announcements to everyone or chosen people.', 'Team vaults': 'Company vaults and their owners.', 'Emergency access': 'Two-person vault access requests.',
}
const web = Platform.OS === 'web'
const pointer = (web ? { cursor: 'pointer' } : {}) as ViewStyle

export default function Home() {
  const { me } = useSession(); const { width } = useWindowDimensions(); const c = useColors()
  const [hover, setHover] = useState('')
  const tiles = homeTiles(me?.capabilities ?? []); const primary = tiles.filter(tile => ['Messenger', 'Passwords', 'Profile & security'].includes(tile.title)); const admin = tiles.filter(tile => !primary.includes(tile))
  // Reference grid: one column on phones, `sm:grid-cols-2 sm:gap-4`, `lg:grid-cols-3`.
  const sm = width >= 640; const cols = width >= 1024 ? 3 : sm ? 2 : 1; const gap = sm ? 16 : 12
  const hoverProps = (key: string) => ({ onHoverIn: () => setHover(key), onHoverOut: () => setHover(h => h === key ? '' : h) })
  return <Workspace><ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 }}>
    {width >= 768 && <Text accessibilityRole="header" style={{ marginBottom: 24, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: c.text }}>{greeting()}, {me?.display_name || me?.full_name?.split(' ')[0] || me?.name || 'there'}</Text>}
    <View style={{ gap }}>{Array.from({ length: Math.ceil(primary.length / cols) }, (_, row) => <View key={row} style={{ flexDirection: 'row', gap }}>{[...primary.slice(row * cols, row * cols + cols), ...Array(cols).fill(null)].slice(0, cols).map((tile, n) => !tile ? <View key={'blank' + n} style={{ flex: 1 }} /> : <View key={tile.title} style={{ flex: 1, minWidth: 0 }}>
      <Link replace href={tile.href as Href} asChild><Pressable accessibilityRole="link" accessibilityLabel={tile.title} {...hoverProps(tile.title)} style={{ flex: 1, ...pointer }}>
        <View style={[{ flex: 1, flexDirection: sm ? 'column' : 'row', alignItems: sm ? 'flex-start' : 'center', gap: 16, padding: sm ? 20 : 16, borderWidth: 1, borderRadius: radius.panel, transform: [{ translateY: hover === tile.title ? -2 : 0 }] }, glass(c, 2), web ? ({ transitionProperty: 'transform', transitionDuration: '150ms' } as ViewStyle) : null]}>
          <View style={{ width: 40, height: 40, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', backgroundColor: c.successSoft }}><Icon name={icons[tile.title] ?? 'home'} size={20} color={c.brand} /></View>
          <View style={{ flex: sm ? undefined : 1, minWidth: 0 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 24, color: c.text }}>{tile.title}</Text>
            <Text style={{ marginTop: sm ? 4 : 2, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>{descriptions[tile.title]}</Text>
          </View>
        </View>
      </Pressable></Link>
    </View>)}</View>)}</View>
    {admin.length > 0 && <View style={{ marginTop: 32 }}>
      <Text accessibilityRole="header" style={{ marginBottom: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 14, lineHeight: 20, color: c.muted, letterSpacing: 0.35, textTransform: 'uppercase' }}>Administration</Text>
      <View style={[{ borderWidth: 1, borderRadius: radius.panel, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }, glass(c, 2)]}>{admin.map((tile, i) => {
        const odd = i % 2 === 0; const lastRow = sm ? i >= admin.length - (admin.length % 2 || 2) : i === admin.length - 1
        return <View key={tile.title} style={{ width: sm ? '50%' : '100%', borderColor: c.border, borderBottomWidth: lastRow && !sm ? 0 : 1, borderRightWidth: sm && odd ? 1 : 0 }}>
          <Link replace href={tile.href as Href} asChild><Pressable accessibilityRole="link" accessibilityLabel={tile.title} {...hoverProps('admin:' + tile.title)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56, backgroundColor: hover === 'admin:' + tile.title ? (c.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)') : 'transparent', ...pointer }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.successSoft }}><Icon name={icons[tile.title] ?? 'shield'} size={16} color={c.brand} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{tile.title}</Text>
              <Text numberOfLines={1} style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{descriptions[tile.title]}</Text>
            </View>
            <Icon name="chevronRight" size={16} color={c.muted} />
          </Pressable></Link>
        </View>
      })}</View>
    </View>}
  </ScrollView></Workspace>
}
