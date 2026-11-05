import { Fragment, useState } from 'react'
import { Platform, View, Text, ScrollView, Pressable, useWindowDimensions, type ViewStyle } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link, Redirect, useLocalSearchParams, usePathname, useRouter } from 'expo-router'
import { useSession } from '../core/auth/Session'
import { Label, Spinner, glass, radius, useColors } from '../ui'
import { errorMessage, origin } from '../core/api/client'
import { mediaUrl } from '../modules/messenger/media/url'
import { useTheme } from '../core/theme/useTheme'
import { ChatAvatar } from './ChatAvatar'
import { ConfirmDialog } from './Sheet'
import type { ReactNode } from 'react'
import { ConnectionStatus } from './ConnectionStatus'
import { LiveAlertBanner, useLiveUpdates } from './LiveUpdates'
import { Brand } from './Brand'
import { Icon, type IconName } from './Icon'
import { AppBackdrop } from './Backdrop'
import { allows } from '../config/capabilities'
import { isActiveShellLink, isWide, shellLinks, type ShellLink } from '../shared/shellLayout'
import { WorkspaceChrome } from './WorkspaceChrome'
import { BellMenu } from './BellMenu'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [railScroll, setRailScroll] = useState(0)
  const inset = useSafeAreaInsets()
  const router = useRouter(); const theme = useTheme()
  const { summary } = useLiveUpdates()
  const approvalsBadge = badgeText(useWaitingApprovals(!preview && !!me && allows(me.capabilities ?? [], APPROVALS_ACCESS)))
  if (!preview && (status === 'loading' || status === 'signing-out')) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: c.bg }}><View style={{ alignItems: 'center' }}><Spinner label="Restoring session" /></View></SafeAreaView>
  if (!preview && status === 'unreachable') return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ConnectionStatus reconnecting error={sessionError || 'Cannot reach JM.'} onRetry={() => void retry()} /></SafeAreaView>
  if (!me && !preview) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => { for (const item of Array.isArray(value) ? value : [value]) if (typeof item === 'string') query.append(key, item) })
    return <Redirect href={{ pathname: '/login', params: { next: safeNext(pathname + (query.size ? '?' + query.toString() : '')) } }} />
  }
  const wide = isWide(width)
  const { rail, tabs, account, tools } = shellLinks(me?.capabilities ?? [], preview)
  // Reference Shell: Messenger is a "full" layout (no page padding); ordinary pages get 32px on desktop.
  const chatsPage = pathname.startsWith('/messenger')
  const chatChrome: ViewStyle = chatsPage ? { backgroundColor: c.shell, borderColor: c.dark ? 'rgba(94,234,212,0.16)' : 'rgba(21,128,61,0.14)' } : {}
  const full = preview || chatsPage
  const lit = (l: ShellLink) => isActiveShellLink(pathname, params, l)
  const pageTitle = pathname === '/home' ? greeting() : pathname.startsWith('/messenger') ? 'Chats' : pathname.startsWith('/admin') && params.user ? 'Person' : [...rail, ...tabs, ...account].find(lit)?.title ?? 'JIVO JM'
  const closeMenu = () => { setMenuOpen(false); setConfirmOut(false) }
  const signOut = () => { setSigningOut(true); void logout().catch(e => setError(errorMessage(e))).finally(() => { setSigningOut(false); closeMenu() }) }
  const go = (href: string) => { closeMenu(); router.replace((preview ? '/preview' : href) as '/home') }
  // Reference nav badges: brand pill for unread chats and notifications, amber pill for approvals waiting on this person.
  const badges: Record<string, { text: string; color: string; label: string; dot?: boolean } | undefined> = {
    '/messenger': summary.unread_conversations > 0 ? { text: badgeText(summary.unread_conversations), color: c.brandFill, label: `${summary.unread_conversations} unread chats` } : undefined,
    '/notifications': !preview && summary.unread_notifications > 0 ? { text: summary.unread_notifications > 99 ? '99+' : String(summary.unread_notifications), color: c.dangerFill, label: `${summary.unread_notifications} unread notifications`, dot: true } : undefined,
    '/approvals': approvalsBadge ? { text: approvalsBadge, color: c.warningFill, label: `${approvalsBadge} waiting for your approval` } : undefined,
  }
  // Reference: chats/approvals use the 20px pill (11px semibold); the bell uses the 16px danger dot (10px bold).
  const badge = (href: string, top: number, right: number) => { const b = badges[href]; if (!b) return null
    const size = b.dot ? 16 : 20
    return <View accessibilityLabel={b.label} style={{ position: 'absolute', top: b.dot ? -6 : top, right: b.dot ? right - (right === -8 ? 0 : -2) : right, height: size, minWidth: size, paddingHorizontal: b.dot ? 4 : 6, borderRadius: size / 2, backgroundColor: b.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#ffffff', fontFamily: b.dot ? 'Inter_700Bold' : 'Inter_600SemiBold', fontWeight: b.dot ? '700' : '600', fontSize: b.dot ? 10 : 11, lineHeight: b.dot ? 10 : 12 }}>{b.text}</Text></View> }
  const name = me?.name ?? 'Example Person'
  const avatar = (size: number) => <ChatAvatar name={name} seed={me?.id} uri={mediaUrl(me?.avatar_url, origin)} size={size} />
  // Reference sidebarRow (collapsed): 48x40, 10px radius, 20px muted icon; active is the success-soft pill in the brand colour.
  // Plain style objects on purpose: expo-router's `Link asChild` slot drops Pressable style functions on web.
  const railRow = (active: boolean, key: string, height = 40): ViewStyle => ({ width: 48, height, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: active ? c.successSoft : hover === key ? c.hover : 'transparent', ...pointer })
  const hoverProps = (key: string) => ({ onHoverIn: () => setHover(key), onHoverOut: () => setHover(h => h === key ? '' : h) })
  const bellBottom = 64 + 8 + Math.max(0, rail.findIndex(l => l.href === '/notifications')) * 44 + 40 - railScroll
  const railItem = (l: ShellLink) => { const active = lit(l)
    // Reference rail bell is a menu button (latest notifications), not a link; the phone Inbox tab stays a link.
    if (l.href === '/notifications' && !preview) { const unread = summary.unread_notifications
      return <Pressable key={l.href} accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'} accessibilityState={{ expanded: bellOpen, selected: active }} onPress={() => setBellOpen(o => !o)} {...hoverProps(l.href)} style={railRow(active, l.href)}><View><Icon name={l.icon} size={20} color={active ? c.brand : hover === l.href ? c.text : c.muted} />{badge(l.href, -8, -8)}</View></Pressable> }
    return <Link replace key={l.href} href={(preview ? '/preview' : l.href) as '/messenger'} accessibilityLabel={l.title} asChild><Pressable accessibilityLabel={l.title} accessibilityState={{ selected: active }} {...hoverProps(l.href)} style={railRow(active, l.href)}><View><Icon name={l.icon} size={20} color={active ? c.brand : hover === l.href ? c.text : c.muted} />{badge(l.href, -8, -8)}</View></Pressable></Link> }
  const railTheme = <Pressable key="theme" accessibilityRole="button" accessibilityLabel={theme.dark ? 'Switch to light theme' : 'Switch to dark theme'} onPress={() => void theme.set(theme.dark ? 'light' : 'dark')} {...hoverProps('theme')} style={railRow(false, 'theme')}><Icon name={theme.dark ? 'sun' : 'moon'} size={20} color={hover === 'theme' ? c.text : c.muted} /></Pressable>
  // Reference RailTooltips: hovering a rail icon shows its name in a dark label 10px to the right (web only).
  const railOrder = rail.flatMap(l => l.href === tools ? [l.href, 'theme'] : [l.href]).concat(tools ? [] : ['theme'])
  const tipText = (key: string) => key === 'theme' ? (theme.dark ? 'Switch to light theme' : 'Switch to dark theme') : key === '/profile' ? `Profile: ${name}` : key === '/notifications' && summary.unread_notifications ? `Notifications, ${summary.unread_notifications} unread` : rail.find(l => l.href === key)?.title
  const tipIndex = railOrder.indexOf(hover)
  const tipStyle: ViewStyle = { position: 'absolute', zIndex: 70, left: 70, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: c.dark ? '#f1f5f9' : '#0f172a', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', ...(Platform.OS === 'web' ? ({ pointerEvents: 'none', whiteSpace: 'nowrap' } as ViewStyle) : {}) }
  const railTip = Platform.OS === 'web' && (tipIndex >= 0 || hover === '/profile') && tipText(hover) ? <View role="tooltip" style={[tipStyle, hover === '/profile' ? { bottom: 24 } : { top: 64 + 8 + tipIndex * 44 + 20 - 12 - railScroll }]}><Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 12, lineHeight: 16, color: c.dark ? '#0f172a' : '#ffffff' }}>{tipText(hover)}</Text></View> : null
  const profileActive = pathname.startsWith('/profile')
  // Reference UserMenu (sidebar, collapsed) and ProfileTab: the person's photo opens Profile; holding it opens the account menu.
  const railProfile = <Link replace href={(preview ? '/preview' : '/profile') as '/profile'} accessibilityLabel={`Profile: ${name}`} asChild><Pressable accessibilityLabel={`Profile: ${name}`} accessibilityState={{ selected: profileActive }} onLongPress={() => setMenuOpen(true)} delayLongPress={450} {...hoverProps('/profile')} style={railRow(profileActive, '/profile', 48)}>{avatar(32)}</Pressable></Link>
  // Reference tabbarItem: 64px high, 24px icon over an 11px medium label, brand colour when active.
  const tabStyle: ViewStyle = { flex: 1, minWidth: 0, minHeight: 64, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center', gap: 4, ...pointer }
  const tabLabel = (text: string, active: boolean) => <Text numberOfLines={1} style={{ maxWidth: '100%', fontFamily: 'Inter_500Medium', fontWeight: '500', color: active ? c.brand : c.muted, fontSize: 11, lineHeight: 14, ...(Platform.OS === 'web' ? { marginTop: -1, marginBottom: 1 } : {}) }}>{text}</Text>
  const tabItem = (l: ShellLink) => {
    const active = lit(l)
    if (l.href === '/profile') return <Link replace key={l.href} href={(preview ? '/preview' : l.href) as '/profile'} accessibilityLabel={`Profile: ${name}`} asChild><Pressable accessibilityLabel={`Profile: ${name}`} accessibilityState={{ selected: active }} onLongPress={() => setMenuOpen(true)} delayLongPress={450} style={tabStyle}>{avatar(26)}{tabLabel('Profile', active)}</Pressable></Link>
    return <Link replace key={l.href} href={(preview ? '/preview' : l.href) as '/messenger'} accessibilityLabel={l.tabTitle} asChild><Pressable accessibilityLabel={l.tabTitle} accessibilityState={{ selected: active }} style={tabStyle}><View style={{ minWidth: 52, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: active && chatsPage ? c.successSoft : 'transparent' }}><Icon name={l.icon} size={24} color={active ? c.brand : c.muted} />{badge(l.href, -6, -12)}</View>{tabLabel(l.tabTitle, active)}</Pressable></Link>
  }
  const menuRow = (label: string, icon: IconName, onPress: () => void, danger = false) => <Pressable key={label} accessibilityRole="menuitem" accessibilityLabel={label} onPress={onPress} {...hoverProps('menu:' + label)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, backgroundColor: hover === 'menu:' + label ? (danger ? (c.dark ? 'rgba(248,113,113,0.1)' : 'rgba(185,28,28,0.1)') : c.hover) : 'transparent', ...pointer }}><Icon name={icon} size={16} color={danger ? c.danger : c.text} /><Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: danger ? c.danger : c.text }}>{label}</Text></Pressable>
  return <WorkspaceChrome.Provider value={setImmersive}><SafeAreaView style={{ flex: 1, backgroundColor: chatsPage ? c.shell : c.bg }}>
    {!chatsPage && <AppBackdrop dark={c.dark} />}
    {/* Reference phone top bar: only the logo, where you are, and the light/dark switch. */}
    {!wide && !immersive && <View style={[{ height: 56, paddingLeft: 16, paddingRight: 8, gap: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' }, glass(c, 1), chatChrome, chatsPage ? { zIndex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' } : {}]}>
      <Brand compact />
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 18, lineHeight: 28 }}>{pageTitle}</Text>
      <ThemeToggle />
      {!preview && me?.capabilities.includes('JM_ACCESS') && <Pressable accessibilityRole="button" accessibilityLabel={summary.unread_notifications ? `Notifications, ${summary.unread_notifications} unread` : 'Notifications'} onPress={() => router.push('/notifications')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><View><Icon name="bell" size={23} color={c.muted} />{badge('/notifications', -6, -8)}</View></Pressable>}
      {preview && <Link replace href="/login" style={{ color: c.primary }}>Back to sign in</Link>}
    </View>}
    {!!error && <Label>{error}</Label>}
    {!preview && !pathname.startsWith('/messenger') && <ConnectionStatus />}
    {!preview && <LiveAlertBanner />}
    {preview && <Text style={{ padding: 10, color: c.muted }}>Layout preview • fictional content • no API requests</Text>}
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      {wide && <View style={[{ width: 72, borderRightWidth: 1, alignItems: 'center' }, glass(c, 1)]}>
        <View style={{ height: 64, width: 72, justifyContent: 'center', alignItems: 'center' }}><Brand compact /></View>
        <ScrollView style={{ flex: 1, alignSelf: 'stretch' }} scrollEventThrottle={16} onScroll={e => setRailScroll(e.nativeEvent.contentOffset.y)} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 4, alignItems: 'center' }}>
          {rail.map(l => <Fragment key={l.href}>{railItem(l)}{l.href === tools && railTheme}</Fragment>)}
          {!tools && railTheme}
        </ScrollView>
        <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>{preview ? <Link replace href="/login" accessibilityLabel="Back to sign in"><Icon name="back" /></Link> : railProfile}</View>
      </View>}
      <View style={{ flex: 1, minWidth: 0, ...(wide && !full ? { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 } : {}) }}>{children}</View>
      {!wide && !immersive && <View accessibilityLabel="Main" style={[{ flexDirection: 'row', borderTopWidth: 1 }, glass(c, 1), chatChrome, chatsPage ? { boxShadow: '0 -2px 10px rgba(0,0,0,0.08)' } : {}]}>{tabs.map(tabItem)}</View>}
    </View>
    {/* Reference ProfileTab hold menu: Profile & security and Sign out (asks first). Approvals and Administration,
        which are not in the phone bar, are listed here too until the Profile page links to them. */}
    {wide && !bellOpen && railTip}
    {wide && bellOpen && <BellMenu anchorBottom={bellBottom} unread={summary.unread_notifications} onClose={() => setBellOpen(false)} />}
    {/* Reference ProfileTab hold menu: a 224px card above the tab bar (bottom-right), or beside the rail photo on desktop. */}
    {menuOpen && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <Pressable accessibilityLabel="Close menu" onPress={closeMenu} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(Platform.OS === 'web' ? ({ cursor: 'default' } as unknown as ViewStyle) : {}) }} />
      <View accessibilityRole="menu" accessibilityLabel="Account" style={[{ position: 'absolute', width: 224, padding: 4, borderRadius: radius.card, borderWidth: 1, borderColor: c.border, backgroundColor: c.dark ? '#0f172a' : '#ffffff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }, wide ? { left: 65, bottom: 16 } : { right: 8, bottom: 72 + inset.bottom }]}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}><Text numberOfLines={1} style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 14, lineHeight: 20, color: c.text }}>{name}</Text>{!!me?.email && <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{me.email}</Text>}</View>
        <View style={{ height: 1, marginVertical: 4, backgroundColor: c.border }} />
        {account.map(l => menuRow(l.href === '/profile' ? 'Profile & security' : l.title, l.href === '/profile' ? 'user' : l.icon, () => go(l.href)))}
        {menuRow('Sign out', 'logout', () => { setMenuOpen(false); setConfirmOut(true) }, true)}
      </View>
    </View>}
    <ConfirmDialog visible={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out of JM?" body="You will need your password (and passkey, if you use one) to sign in again on this device." confirmLabel="Sign out" danger loading={signingOut} onConfirm={signOut} />
  </SafeAreaView></WorkspaceChrome.Provider>
}

