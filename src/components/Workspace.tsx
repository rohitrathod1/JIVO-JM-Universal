import { Fragment, useState } from 'react'
import { Platform, View, Text, ScrollView, Pressable, useWindowDimensions, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, Redirect, useLocalSearchParams, usePathname } from 'expo-router'
import { useSession } from '../core/auth/Session'
import { Button, Label, Spinner, glass, radius, useColors } from '../ui'
import { errorMessage } from '../core/api/client'
import type { ReactNode } from 'react'
import { ConnectionStatus } from './ConnectionStatus'
import { LiveAlertBanner, useLiveUpdates } from './LiveUpdates'
import { Brand } from './Brand'
import { Icon, IconButton } from './Icon'
import { AppBackdrop } from './Backdrop'
import { allows } from '../config/capabilities'
import { isActiveLink, isWide, shellLinks, type ShellLink } from '../shared/shellLayout'
import { WorkspaceChrome } from './WorkspaceChrome'
import { ThemeToggle } from './ThemeControls'
import { greeting, safeNext } from '../shared/authNavigation'
import { useWaitingApprovals } from '../modules/approvals/useWaitingApprovals'
import { APPROVALS_ACCESS, badgeText } from '../modules/approvals/model'
const pointer = (Platform.OS === 'web' ? { cursor: 'pointer' } : {}) as ViewStyle
export function Workspace({ children, preview = false }: { children: ReactNode; preview?: boolean }) {
  const { me, logout, status, retry, error: sessionError } = useSession(); const c = useColors(); const { width } = useWindowDimensions()
  const pathname = usePathname()
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const [error, setError] = useState('')
  const [immersive, setImmersive] = useState(false)
  const [hover, setHover] = useState('')
  const { summary } = useLiveUpdates()
  const approvalsBadge = badgeText(useWaitingApprovals(!preview && !!me && allows(me.capabilities ?? [], APPROVALS_ACCESS)))
  if (!preview && (status === 'loading' || status === 'signing-out')) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: c.bg }}><View style={{ alignItems: 'center' }}><Spinner label="Restoring session" /></View></SafeAreaView>
  if (!preview && status === 'unreachable') return <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20, backgroundColor: c.bg }}><Label>{sessionError || 'Cannot reach JM.'}</Label><Button title="Retry connection" onPress={() => void retry()} /></SafeAreaView>
  if (!me && !preview) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => { for (const item of Array.isArray(value) ? value : [value]) if (typeof item === 'string') query.append(key, item) })
    return <Redirect href={{ pathname: '/login', params: { next: safeNext(pathname + (query.size ? '?' + query.toString() : '')) } }} />
  }
  const wide = isWide(width)
  const { rail, tabs } = shellLinks(me?.capabilities ?? [], preview)
  // Reference Shell: Messenger is a "full" layout (no page padding); ordinary pages get 32px on desktop.
  const full = preview || pathname.startsWith('/messenger')
  const pageTitle = pathname === '/home' ? greeting() : pathname.startsWith('/messenger') ? 'Chats' : pathname.startsWith('/notifications') ? 'Notifications' : rail.find(link => isActiveLink(pathname, link.href))?.title ?? 'Home'
  const signOut = () => { void logout().catch(e => setError(errorMessage(e))) }
  // Reference nav badges: brand pill for unread chats, amber pill for approvals waiting on this person.
  const badges: Record<string, { text: string; color: string; label: string } | undefined> = {
    '/messenger': summary.unread_conversations > 0 ? { text: badgeText(summary.unread_conversations), color: c.brand, label: `${summary.unread_conversations} unread chats` } : undefined,
    '/admin': approvalsBadge ? { text: approvalsBadge, color: '#f59e0b', label: `${approvalsBadge} waiting for your approval` } : undefined,
  }
  const badge = (href: string, top: number, right: number) => { const b = badges[href]; return b ? <View accessibilityLabel={b.label} style={{ position: 'absolute', top, right, height: 20, minWidth: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: b.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 11, lineHeight: 12 }}>{b.text}</Text></View> : null }
  // Reference sidebarRow (collapsed): 40px high, 10px radius, muted icon; active is success-soft with the brand colour.
  const railItem = (l: ShellLink) => { const active = isActiveLink(pathname, l.href); return <Link replace key={l.href} href={(preview ? '/preview' : l.href) as '/messenger'} accessibilityLabel={l.title} asChild><Pressable accessibilityLabel={l.title} accessibilityState={{ selected: active }} onHoverIn={() => setHover(l.href)} onHoverOut={() => setHover(h => h === l.href ? '' : h)} style={({ pressed }) => ({ width: 48, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: active ? c.successSoft : pressed || hover === l.href ? c.hover : 'transparent', ...pointer })}><View><Icon name={l.icon} size={20} color={active ? c.brand : hover === l.href ? c.text : c.muted} />{badge(l.href, -8, -8)}</View></Pressable></Link> }
  // Reference tabbarItem: 64px high, 24px icon over an 11px medium label, brand colour when active.
  const tabItem = (l: ShellLink) => { const active = isActiveLink(pathname, l.href); return <Link replace key={l.href} href={(preview ? '/preview' : l.href) as '/messenger'} accessibilityLabel={l.title} asChild><Pressable accessibilityLabel={l.title} accessibilityState={{ selected: active }} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 64, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center', gap: 4, transform: [{ scale: pressed ? 0.95 : 1 }], ...pointer })}><View><Icon name={l.icon} size={24} color={active ? c.brand : c.muted} />{badge(l.href, -6, -12)}</View><Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', color: active ? c.brand : c.muted, fontSize: 11, lineHeight: 14 }}>{l.tabTitle}</Text></Pressable></Link> }
  return <WorkspaceChrome.Provider value={setImmersive}><SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
    <AppBackdrop dark={c.dark} />
    {!wide && !immersive && <View style={[{ height: 56, paddingLeft: 16, paddingRight: 8, gap: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' }, glass(c, 1)]}>
      <Brand compact />
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 18, lineHeight: 28 }}>{pageTitle}</Text>
      <ThemeToggle />
      {preview ? <Link replace href="/login" style={{ color: c.primary }}>Back to sign in</Link> : <IconButton name="logout" label="Sign out" onPress={signOut} />}
    </View>}
    {!!error && <Label>{error}</Label>}
    {!preview && <ConnectionStatus />}
    {!preview && <LiveAlertBanner />}
    {!preview && summary.unread_notifications > 0 && <Link replace href="/notifications" style={{ padding: 8, color: c.primary }}>{summary.unread_notifications} unread notifications</Link>}
    {preview && <Text style={{ padding: 10, color: c.muted }}>Layout preview • fictional content • no API requests</Text>}
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      {wide && <View style={[{ width: 72, borderRightWidth: 1, alignItems: 'center' }, glass(c, 1)]}>
        <View style={{ height: 64, width: 72, justifyContent: 'center', alignItems: 'center' }}><Brand compact /></View>
        <ScrollView style={{ flex: 1, alignSelf: 'stretch' }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 4, alignItems: 'center' }}>
          {rail.map(l => <Fragment key={l.href}>{railItem(l)}{l.href === '/notifications' && <ThemeToggle />}</Fragment>)}
        </ScrollView>
        <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>{preview ? <Link replace href="/login" accessibilityLabel="Back to sign in"><Icon name="back" /></Link> : <IconButton name="logout" label="Sign out" onPress={signOut} />}</View>
      </View>}
      <View style={{ flex: 1, minWidth: 0, ...(wide && !full ? { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 } : {}) }}>{children}</View>
      {!wide && !immersive && <View style={[{ flexDirection: 'row', borderTopWidth: 1 }, glass(c, 1)]}>{tabs.map(tabItem)}</View>}
    </View>
  </SafeAreaView></WorkspaceChrome.Provider>
}

