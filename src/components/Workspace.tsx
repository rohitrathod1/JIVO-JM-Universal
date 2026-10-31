import { useState } from 'react'
import { ActivityIndicator, View, Text, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, Redirect } from 'expo-router'
import { useSession } from '../core/auth/Session'
import { allows, ADMIN_ACCESS } from '../config/capabilities'
import { Button, Label, useColors } from '../ui'
import { errorMessage } from '../core/api/client'
import type { ReactNode } from 'react'
export function Workspace({ children, preview = false }: { children: ReactNode; preview?: boolean }) {
  const { me, logout, status, retry, error: sessionError } = useSession(); const c = useColors(); const { width } = useWindowDimensions()
  const [error, setError] = useState('')
  if (!preview && (status === 'loading' || status === 'signing-out')) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator accessibilityLabel="Restoring session" /></SafeAreaView>
  if (!preview && status === 'unreachable') return <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20, backgroundColor: c.bg }}><Label>{sessionError || 'Cannot reach JM.'}</Label><Button title="Retry connection" onPress={() => void retry()} /></SafeAreaView>
  if (!me && !preview) return <Redirect href="/login" />
  const wide = width >= 900
  const links = [
    ...(preview || allows(me?.capabilities ?? [], 'JM_ACCESS') ? [{ title: 'Messenger', href: '/messenger' }] : []),
    ...(preview || allows(me?.capabilities ?? [], 'JP_ACCESS') ? [{ title: 'Passwords', href: '/passwords' }] : []),
    { title: 'Activity', href: '/notifications' }, { title: 'Profile', href: '/profile' },
    ...(preview || allows(me?.capabilities ?? [], ADMIN_ACCESS) ? [{ title: 'Admin', href: '/admin' }] : []),
  ]
  const nav = <ScrollView horizontal={!wide} contentContainerStyle={{ padding: wide ? 12 : 4, gap: wide ? 8 : 0, ...(wide ? {} : { flexGrow: 1, justifyContent: 'space-around' as const, alignItems: 'center' as const }) }}>
    {links.map(l => <Link key={l.href} href={(preview ? '/preview' : l.href) as '/messenger'} accessibilityLabel={l.title} style={{ color: c.text, padding: wide ? 14 : 10, paddingVertical: 16, fontWeight: '600', fontSize: wide ? 15 : 12 }}>{!wide && l.title === 'Messenger' ? 'Chats' : !wide && l.title === 'Passwords' ? 'Vaults' : l.title}</Link>)}
  </ScrollView>
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
    <View style={{ padding: 16, borderBottomWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Link replace href={preview ? '/preview' : '/'} accessibilityLabel="Home" style={{ color: c.primary, fontSize: 24, fontWeight: '900' }}>JIVO<Text style={{ color: '#E8A317' }}>.</Text> JM</Link>
      {preview ? <Link href="/login" style={{ color: c.primary }}>Back to sign in</Link> : <Button title="Sign out" onPress={() => { void logout().catch(e => setError(errorMessage(e))) }} />}
    </View>
    {!!error && <Label>{error}</Label>}
    {preview && <Text style={{ padding: 10, color: c.muted }}>Layout preview • fictional content • no API requests</Text>}
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      {wide && <View style={{ width: 190, borderRightWidth: 1, borderColor: c.border }}>{nav}</View>}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {!wide && <View style={{ borderTopWidth: 1, borderColor: c.border }}>{nav}</View>}
    </View>
  </SafeAreaView>
}

