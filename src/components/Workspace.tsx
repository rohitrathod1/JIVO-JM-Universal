import { useState } from 'react'
import { ActivityIndicator, View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, Redirect, useLocalSearchParams, usePathname } from 'expo-router'
import { useSession } from '../core/auth/Session'
import { allows, ADMIN_ACCESS } from '../config/capabilities'
import { Button, Label, useColors } from '../ui'
import { errorMessage } from '../core/api/client'
import type { ReactNode } from 'react'
import { ConnectionStatus } from './ConnectionStatus'
import { LiveAlertBanner, useLiveUpdates } from './LiveUpdates'
import { Brand } from './Brand'
import { Icon, IconButton, type IconName } from './Icon'
import { WorkspaceChrome } from './WorkspaceChrome'
import { ThemeToggle } from './ThemeControls'
import { greeting, safeNext } from '../shared/authNavigation'
export function Workspace({ children, preview = false }: { children: ReactNode; preview?: boolean }) {
  const { me, logout, status, retry, error: sessionError } = useSession(); const c = useColors(); const { width } = useWindowDimensions()
  const pathname = usePathname()
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const [error, setError] = useState('')
  const [immersive, setImmersive] = useState(false)
  const { summary } = useLiveUpdates()
  if (!preview && (status === 'loading' || status === 'signing-out')) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator accessibilityLabel="Restoring session" /></SafeAreaView>
  if (!preview && status === 'unreachable') return <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20, backgroundColor: c.bg }}><Label>{sessionError || 'Cannot reach JM.'}</Label><Button title="Retry connection" onPress={() => void retry()} /></SafeAreaView>
  if (!me && !preview) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => { for (const item of Array.isArray(value) ? value : [value]) if (typeof item === 'string') query.append(key, item) })
    return <Redirect href={{ pathname: '/login', params: { next: safeNext(pathname + (query.size ? '?' + query.toString() : '')) } }} />
  }
  const wide = width >= 768
  const links = [
    { title: 'Home', href: '/home' },
    ...(preview || allows(me?.capabilities ?? [], 'JM_ACCESS') ? [{ title: 'Messenger', href: '/messenger' }] : []),
    ...(preview || allows(me?.capabilities ?? [], 'JP_ACCESS') ? [{ title: 'Passwords', href: '/passwords' }] : []),
    { title: 'Activity', href: '/notifications' }, { title: 'Profile', href: '/profile' },
    ...(preview || allows(me?.capabilities ?? [], ADMIN_ACCESS) ? [{ title: 'Admin', href: '/admin' }] : []),
  ]
  const navIcons: Record<string, IconName> = { Home: 'home', Messenger: 'chat', Passwords: 'key', Activity: 'bell', Profile: 'user', Admin: 'shield' }
  const pageTitle = pathname === '/home' ? greeting() : pathname.startsWith('/messenger') ? 'Chats' : pathname.startsWith('/notifications') ? 'Notifications' : links.find(link => pathname.startsWith(link.href))?.title ?? 'Home'
  const nav = <ScrollView horizontal={!wide} contentContainerStyle={{ padding: wide ? 12 : 4, gap: wide ? 8 : 0, ...(wide ? {} : { flexGrow: 1, justifyContent: 'space-around' as const, alignItems: 'center' as const }) }}>
    {links.map(l => { const active = pathname === l.href || pathname.startsWith(l.href + '/'); return <Link replace key={l.href} href={(preview ? '/preview' : l.href) as '/messenger'} accessibilityLabel={l.title} asChild><Pressable accessibilityLabel={l.title} accessibilityState={{ selected: active }} style={({ pressed }) => ({ minWidth: 44, minHeight: wide ? 44 : 56, padding: wide ? 10 : 6, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10, backgroundColor: (wide && active) || pressed ? c.soft : 'transparent' })}><Icon name={navIcons[l.title]} color={active ? c.brand : c.muted} />{!wide && <Text style={{ fontFamily: 'Inter_600SemiBold', color: active ? c.brand : c.muted, fontSize: 10 }}>{l.title === 'Messenger' ? 'Chats' : l.title === 'Passwords' ? 'Passwords' : l.title}</Text>}</Pressable></Link> })}
    {wide && <ThemeToggle />}
  </ScrollView>
  return <WorkspaceChrome.Provider value={setImmersive}><SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
    {!wide && !immersive && <View style={{ minHeight: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.shell, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Brand compact />
      <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 18, paddingHorizontal: 8 }}>{pageTitle}</Text>
      <ThemeToggle />
      {preview ? <Link replace href="/login" style={{ color: c.primary }}>Back to sign in</Link> : <IconButton name="logout" label="Sign out" onPress={() => { void logout().catch(e => setError(errorMessage(e))) }} />}
    </View>}
    {!!error && <Label>{error}</Label>}
    {!preview && <ConnectionStatus />}
    {!preview && <LiveAlertBanner />}
    {!preview && summary.unread_notifications > 0 && <Link replace href="/notifications" style={{ padding: 8, color: c.primary }}>{summary.unread_notifications} unread notifications</Link>}
    {preview && <Text style={{ padding: 10, color: c.muted }}>Layout preview • fictional content • no API requests</Text>}
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      {wide && <View style={{ width: 72, borderRightWidth: 1, borderColor: c.border, backgroundColor: c.shell, alignItems: 'center' }}>
        <View style={{ height: 64, width: 64, justifyContent: 'center', alignItems: 'center' }}><Brand compact /></View>
        {nav}
        <View style={{ padding: 12 }}>{preview ? <Link replace href="/login" accessibilityLabel="Back to sign in"><Icon name="back" /></Link> : <IconButton name="logout" label="Sign out" onPress={() => { void logout().catch(e => setError(errorMessage(e))) }} />}</View>
      </View>}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {!wide && !immersive && <View style={{ borderTopWidth: 1, borderColor: c.border, backgroundColor: c.shell }}>{nav}</View>}
    </View>
  </SafeAreaView></WorkspaceChrome.Provider>
}

