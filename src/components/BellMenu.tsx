import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, Text, View, useWindowDimensions, type ViewStyle } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { glass, radius, useColors, Spinner } from '../ui'
import { Icon } from './Icon'
import { listNotifications, markNotificationsRead, type AppNotification } from '../modules/notifications/api'
import { formatRelative } from '../shared/utils/format'

const web = Platform.OS === 'web'
const pointer = (web ? { cursor: 'pointer' } : {}) as ViewStyle

/**
 * Reference NotificationBell `BellMenu` (desktop rail): the latest three notifications, "Mark all read" and
 * "View all notifications & settings". Opens to the right of the rail, bottom-aligned with the bell.
 */
export function BellMenu({ anchorBottom, onClose, unread, onChanged }: { anchorBottom: number; onClose: () => void; unread: number; onChanged?: () => void }) {
  const c = useColors(); const router = useRouter(); const { height: screen } = useWindowDimensions()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [height, setHeight] = useState(0)
  const [hover, setHover] = useState('')
  const menu = useRef<unknown>(null)
  // Web keyboard, as the reference Radix DropdownMenu: Escape closes; arrows, Home and End move between items.
  useEffect(() => {
    if (!web || typeof document === 'undefined') return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const root = menu.current as unknown as HTMLElement | null
      const list = root ? Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]')) : []
      if (!list.length) return
      e.preventDefault()
      const at = list.indexOf(document.activeElement as HTMLElement)
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : e.key === 'ArrowDown' ? (at + 1) % list.length : at <= 0 ? list.length - 1 : at - 1
      list[next].focus()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  useEffect(() => {
    let live = true
    listNotifications(null, 3).then(page => { if (live) setItems(page.results) }).catch(() => { if (live) setItems([]) })
    return () => { live = false }
  }, [])
  const open = async (n: AppNotification) => {
    if (!n.read_at) await markNotificationsRead([n.id]).catch(() => undefined)
    onChanged?.(); onClose()
    if (n.link) router.push(n.link as Href)
  }
  const markAll = () => { void markNotificationsRead('all').then(() => { setItems(list => list?.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null); onChanged?.() }).catch(() => undefined) }
  const top = Math.max(8, Math.min(anchorBottom - height, screen - height - 8))
  const row = (key: string): ViewStyle => ({ flexDirection: 'row', gap: 10, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: hover === key ? c.hover : 'transparent', ...pointer, ...(web ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : {}) })
  const hoverProps = (key: string) => ({ onHoverIn: () => setHover(key), onHoverOut: () => setHover(h => h === key ? '' : h), onFocus: () => setHover(key), onBlur: () => setHover(h => h === key ? '' : h) })
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
    <Pressable accessibilityLabel="Close notifications" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(web ? ({ cursor: 'auto' } as ViewStyle) : {}) }} />
    <View ref={menu as never} accessibilityRole="menu" accessibilityLabel="Notifications" onLayout={e => setHeight(e.nativeEvent.layout.height)}
      style={[{ position: 'absolute', left: 65, top, width: 352, maxWidth: '92%', padding: 4, borderWidth: 1, borderRadius: radius.card, opacity: height ? 1 : 0 }, glass(c, 4)]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 14, lineHeight: 20, color: c.text }}>Notifications</Text>
        {unread > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Mark all read" onPress={markAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, ...pointer }}>
          <Icon name="checks" size={14} color={c.brand} /><Text style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 12, lineHeight: 16, color: c.brand }}>Mark all read</Text>
        </Pressable>}
      </View>
      <View style={{ height: 1, marginVertical: 4, backgroundColor: c.border }} />
      {items === null ? <View style={{ alignItems: 'center', paddingVertical: 24 }}><Spinner /></View>
        : items.length ? items.map(n => <Pressable key={n.id} accessibilityRole="menuitem" accessibilityLabel={n.title} onPress={() => void open(n)} {...hoverProps(n.id)} style={row(n.id)}>
          <View style={{ marginTop: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: n.read_at ? 'transparent' : c.brand }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: n.read_at ? 'Inter_400Regular' : 'Inter_600SemiBold', fontWeight: n.read_at ? '400' : '600', fontSize: 14, lineHeight: 20, color: c.text }}>{n.title}</Text>
            {!!n.body && <Text numberOfLines={2} style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{n.body}</Text>}
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16.5, color: c.muted }}>{formatRelative(n.created_at)}</Text>
          </View>
        </Pressable>)
        : <Text style={{ paddingHorizontal: 10, paddingVertical: 24, textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>You&apos;re all caught up.</Text>}
      <View style={{ height: 1, marginVertical: 4, backgroundColor: c.border }} />
      <Pressable accessibilityRole="menuitem" accessibilityLabel="View all notifications & settings" onPress={() => { onClose(); router.replace('/notifications') }} {...hoverProps('all')} style={[row('all'), { alignItems: 'center', gap: 8 }]}>
        <Icon name="settings" size={16} color={c.text} /><Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.text }}>View all notifications & settings</Text>
      </Pressable>
    </View>
  </View>
}
