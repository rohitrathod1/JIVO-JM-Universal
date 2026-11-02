import { Link, type Href } from 'expo-router'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { Workspace } from '../components/Workspace'
import { useSession } from '../core/auth/Session'
import { homeTiles } from '../shared/homeTiles'
import { greeting } from '../shared/authNavigation'
import { Icon, type IconName } from '../components/Icon'
import { Card, Label, styles, useColors } from '../ui'

const icons: Record<string, IconName> = { Messenger: 'chat', Passwords: 'key', 'Profile & security': 'shield', People: 'users', 'Permission groups': 'shield', Security: 'lock', Alerts: 'bell', 'Team vaults': 'key', 'Emergency access': 'unlock' }
const descriptions: Record<string, string> = {
  Messenger: 'Chats and groups with anyone across JIVO.', Passwords: 'Shared team passwords, kept encrypted.', 'Profile & security': 'Your details, passkeys, password and signed-in devices.',
  People: 'Accounts, invitations and access.', 'Permission groups': 'What each group allows.', Security: 'Two-step verification for everyone.', Alerts: 'Announcements to everyone or chosen people.', 'Team vaults': 'Company vaults and their owners.', 'Emergency access': 'Two-person vault access requests.',
}
export default function Home() {
  const { me } = useSession(); const { width } = useWindowDimensions(); const c = useColors()
  const tiles = homeTiles(me?.capabilities ?? []); const primary = tiles.filter(tile => ['Messenger', 'Passwords', 'Profile & security'].includes(tile.title)); const admin = tiles.filter(tile => !primary.includes(tile))
  return <Workspace><ScrollView contentContainerStyle={[styles.page, { gap: 24 }]}>
    {width >= 768 && <Label large>{greeting()}, {me?.display_name || me?.full_name?.split(' ')[0] || me?.name || 'there'}</Label>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{primary.map(tile => <View key={tile.title} style={{ width: width < 640 ? '100%' : width < 1100 ? '48%' : '32%' }}><Link replace href={tile.href as Href} asChild><Pressable accessibilityRole="link" accessibilityLabel={tile.title}><Card style={{ flexDirection: width < 640 ? 'row' : 'column', gap: 16, padding: width < 640 ? 16 : 20 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}><Icon name={icons[tile.title]} size={20} color={c.brand} /></View>
      <View style={{ flex: width < 640 ? 1 : undefined, gap: 4 }}><Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: c.text }}>{tile.title}</Text><Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>{descriptions[tile.title]}</Text></View>
    </Card></Pressable></Link></View>)}</View>
    {admin.length > 0 && <View style={{ gap: 12 }}><Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: c.muted, letterSpacing: 1 }}>ADMINISTRATION</Text><Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>{admin.map(tile => <Link replace key={tile.title} href={tile.href as Href} asChild><Pressable accessibilityRole="link" accessibilityLabel={tile.title} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64, borderBottomWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.neutral : 'transparent' })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}><Icon name={icons[tile.title]} size={18} color={c.brand} /></View><View style={{ flex: 1, gap: 3 }}><Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{tile.title}</Text><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }}>{descriptions[tile.title]}</Text></View>
    </Pressable></Link>)}</Card></View>}
  </ScrollView></Workspace>
}
