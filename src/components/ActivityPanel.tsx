import { TimeField } from './TimeField'
import { router } from 'expo-router'
import { notificationTarget } from '../shared/notificationTarget'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Animated, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type PressableStateCallbackType, type ViewStyle } from 'react-native'
import * as notifications from '../modules/notifications/api'
import { useCursor } from '../shared/useCursor'
import { Button, EmptyState, Label, Spinner, Surface, styles, useColors } from '../ui'
import { errorMessage } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { AlertsPanel } from './AlertsPanel'
import { Sheet } from './Sheet'
import { Icon } from './Icon'
import { useSession } from '../core/auth/Session'
import { isWide } from '../shared/shellLayout'
import { DevicePush } from './DevicePush'
import { Muted, PageHeader, RowButton, Select, SeverityDot, SEVERITY_LABEL, ToolButton, UnderlineTabs, font, relative } from './InboxVaultKit'

type PSt = PressableStateCallbackType & { hovered?: boolean }
const web = Platform.OS === 'web'
const pointer = (off = false): ViewStyle => (web ? ({ cursor: off ? 'not-allowed' : 'pointer' } as ViewStyle) : {})
const PREVIEW_LABEL: Record<notifications.Preferences['push_preview'], string> = { none: 'New message only', sender: 'Sender name', sender_and_text: 'Sender + message' }


const SWIPE_REVEAL = 88

/** Reference SwipeToDelete: drag a row left to show a red Delete button; with a mouse, a trash button shows on hover. */
function SwipeRow({ children, onDelete, label, disabled }: { children: ReactNode; onDelete: () => void; label: string; disabled?: boolean }) {
  const c = useColors(); const [x] = useState(() => new Animated.Value(0)); const [open, setOpen] = useState(false); const [hovered, setHovered] = useState(false)
  const settle = useCallback((to: number) => { setOpen(to !== 0); Animated.timing(x, { toValue: to, duration: 200, useNativeDriver: !web }).start() }, [x])
  const pan = useMemo(() => { const base = open ? -SWIPE_REVEAL : 0; return PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_e, g) => x.setValue(Math.min(0, Math.max(-SWIPE_REVEAL - 24, base + g.dx))),
    onPanResponderRelease: (_e, g) => settle(base + g.dx <= -SWIPE_REVEAL / 2 ? -SWIPE_REVEAL : 0),
    onPanResponderTerminate: () => settle(base),
  }) }, [x, settle, open])
  const hover = web ? ({ onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as object) : {}
  return <View style={{ position: 'relative', overflow: 'hidden' }} {...hover}>
    <Pressable accessibilityRole="button" accessibilityLabel="Delete" accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} aria-hidden={!open} tabIndex={open ? 0 : -1} disabled={disabled} onPress={() => { settle(0); onDelete() }}
      style={[{ position: 'absolute', top: 0, bottom: 0, right: 0, width: SWIPE_REVEAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.danger }, pointer()]}>
      <Icon name="trash2" size={16} color="#ffffff" /><Text style={{ fontFamily: font.s, fontWeight: '600', fontSize: 14, color: '#ffffff' }}>Delete</Text>
    </Pressable>
    <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }], backgroundColor: c.dark ? '#0f172a' : '#ffffff' }}>
      {children}
      {open && <Pressable accessibilityLabel="Close delete" onPress={() => settle(0)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
      {!open && web && <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onDelete} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}
        style={({ hovered: on }: PSt) => [{ position: 'absolute', right: 8, top: '50%', marginTop: -14, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', opacity: hovered ? 1 : 0, backgroundColor: on ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }, pointer()]}>
        {({ hovered: on }: PSt) => <Icon name="trash2" size={16} color={on ? c.danger : c.muted} />}
      </Pressable>}
    </Animated.View>
  </View>
}

function NotificationList() {
  const c = useColors(); const { width } = useWindowDimensions(); const [state, setState] = useState<notifications.ReadFilter>('all'); const [kind, setKind] = useState<notifications.KindFilter>('all')
  const load = useCallback((cursor?: string | null) => notifications.listNotifications(cursor, 30, { state, kind }), [state, kind]); const page = useCursor(load)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [selected, setSelected] = useState<notifications.AppNotification | null>(null)
  const [confirmation, setConfirmation] = useState<notifications.AppNotification | null>(null); const [confirmAll, setConfirmAll] = useState(false)
  const refresh = page.refresh
  useEffect(() => realtime.on('*', frame => { if (frame.type.startsWith('NOTIFICATION_') || frame.type === 'RESYNC') void refresh() }), [refresh])
  async function run(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action(); await refresh(); setConfirmation(null); setConfirmAll(false) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  const empty = state === 'unread' ? 'No unread notifications.' : kind === 'alerts' ? 'No alerts.' : 'No notifications.'
  const what = kind === 'alerts' ? 'alerts' : kind === 'messages' ? 'message notifications' : 'notifications'; const shown = state === 'all' ? what : `${state} ${what}`
  const phone = width < 640
  return <>
    <Surface style={{ overflow: 'visible' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: c.border, zIndex: 5 }}>
        <Select label="Show" value={state} onChange={setState} disabled={busy} style={phone ? { flexGrow: 1, flexBasis: 0, minWidth: 0 } : { width: 128 }} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }, { value: 'read', label: 'Read' }]} />
        <Select label="Type" value={kind} onChange={setKind} disabled={busy} style={phone ? { flexGrow: 1, flexBasis: 0, minWidth: 0 } : { width: 144 }} options={[{ value: 'all', label: 'Everything' }, { value: 'messages', label: 'Messages' }, { value: 'alerts', label: 'Alerts' }]} />
        <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4, flexShrink: 0 }}>
          {page.items.some(n => !n.read_at) && <ToolButton icon="checks" iconOnly={phone} label="Mark all read" a11y="Mark all as read" disabled={busy} onPress={() => void run(() => notifications.markNotificationsRead('all'))} />}
          <ToolButton icon="trash2" iconOnly danger label="Delete" a11y="Delete" disabled={busy || !page.items.length} onPress={() => setConfirmAll(true)} />
        </View>
      </View>
      {!!(error || page.error) && <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: font.r, fontSize: 14, padding: 16, textAlign: 'center' }}>{error || page.error}</Text>}
      {page.loading && !page.items.length && <View style={{ padding: 24 }}><Spinner label="Loading notifications" /></View>}
      {!page.loading && !page.items.length && !page.error && <EmptyState title={empty} />}
      {page.items.length > 0 && <View accessibilityLabel="Notifications" style={{ overflow: 'hidden', borderBottomLeftRadius: page.cursor || !isWide(width) ? 0 : 16, borderBottomRightRadius: page.cursor || !isWide(width) ? 0 : 16 }}>{page.items.map((n, i) => {
        const alert = n.kind === 'admin_announcement' ? (n.data as { severity?: string }) : null; const severity = alert?.severity ?? 'info'
        return <View key={n.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}><SwipeRow label="Remove notification" disabled={busy} onDelete={() => setConfirmation(n)}>
          <RowButton label={`Open ${n.title}`} onPress={() => { setSelected(n); if (!n.read_at) void run(() => notifications.markNotificationsRead([n.id])) }}>
            <View style={{ flexDirection: 'row', gap: 12, paddingLeft: 16, paddingRight: 48, paddingVertical: 12 }}>
              <View accessibilityLabel={n.read_at ? undefined : 'Unread'} style={{ marginTop: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: n.read_at ? 'transparent' : c.brand }} />
              {alert && <SeverityDot severity={severity} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: n.read_at ? font.r : font.s, fontWeight: n.read_at ? '400' : '600', fontSize: 14, lineHeight: 20, color: c.text }}>{n.title}</Text>
                {!!n.body && <Muted size={14} lines={2}>{n.body}</Muted>}
                <View style={{ marginTop: 2 }}><Muted>{alert ? `${SEVERITY_LABEL[severity]} alert · ` : ''}{relative(n.created_at)}</Muted></View>
              </View>
            </View>
          </RowButton>
        </SwipeRow></View>
      })}</View>}
      {page.cursor && <View style={{ alignItems: 'center', padding: 8 }}><Button variant="ghost" size="sm" title="More notifications" disabled={page.loading} onPress={() => void page.more()} /></View>}
      {busy && page.items.length > 0 && <View style={{ padding: 8 }}><Spinner /></View>}
      {page.items.length > 0 && !isWide(width) && <Text style={{ fontFamily: font.r, fontSize: 12, lineHeight: 16, color: c.muted, textAlign: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>Swipe a notification left to delete it.</Text>}
    </Surface>
    <Sheet visible={Boolean(selected)} onClose={() => setSelected(null)}><Label large>{selected?.title}</Label>{!!selected?.body && <Muted size={14}>{selected.body}</Muted>}{!!selected && <Muted>{relative(selected.created_at)}</Muted>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <Button variant="secondary" title="Close notification" onPress={() => setSelected(null)} />
        {selected?.link && (notificationTarget(selected.link) ? <Button title="Go to linked item" onPress={() => { const target = notificationTarget(selected.link); if (target) { setSelected(null); router.push(target) } }} /> : <Muted size={14}>This notification destination is not available in this client.</Muted>)}
      </View></Sheet>
    <Sheet visible={Boolean(confirmation)} onClose={() => { if (!busy) setConfirmation(null) }}><Label large>Delete this notification?</Label><Muted size={14}>It is removed from your list on every device.</Muted>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}><Button variant="secondary" title="Cancel" disabled={busy} onPress={() => setConfirmation(null)} /><Button variant="danger" title="Delete" accessibilityLabel="Confirm removal" disabled={busy} onPress={() => { if (confirmation) void run(() => notifications.deleteNotifications([confirmation.id])) }} /></View></Sheet>
    <Sheet visible={confirmAll} onClose={() => { if (!busy) setConfirmAll(false) }}><Label large>{`Delete all ${shown}?`}</Label><Muted size={14}>They are removed from your list on every device.</Muted>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}><Button variant="secondary" title="Cancel" disabled={busy} onPress={() => setConfirmAll(false)} /><Button variant="danger" title="Delete" accessibilityLabel="Confirm delete all" disabled={busy} onPress={() => void run(() => notifications.deleteNotifications({ all: true, state, kind }))} /></View></Sheet>
  </>
}

/** Reference settings Section: Surface p-5 with a semibold heading row. */
function Section({ title, aside, children, z = 1 }: { title: string; aside?: ReactNode; children: ReactNode; z?: number }) {
  const c = useColors()
  return <Surface style={{ padding: 20, overflow: 'visible', zIndex: z }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}><Text accessibilityRole="header" style={{ fontFamily: font.s, fontWeight: '600', fontSize: 16, lineHeight: 24, color: c.text }}>{title}</Text>{aside}</View>
    {children}
  </Surface>
}

/** Reference Checkbox: 16px box, medium label, muted xs description. */
function Check({ label, description, value, onChange, a11y, disabled }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; a11y?: string; disabled?: boolean }) {
  const c = useColors()
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={a11y ?? label} aria-checked={value} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, pointer(disabled)]}>
    <View style={{ marginTop: 2, width: 16, height: 16, borderRadius: 3, borderWidth: value ? 0 : 1, borderColor: c.dark ? '#94a3b8' : '#767676', backgroundColor: value ? c.primary : (c.dark ? '#0f172a' : '#ffffff'), alignItems: 'center', justifyContent: 'center' }}>{value && <Icon name="check" size={12} color="#ffffff" />}</View>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>{label}</Text>{!!description && <Muted>{description}</Muted>}</View>
  </Pressable>
}

const PREF_DESCRIPTION = { push_enabled: 'On every device where you turned them on.', sound_enabled: 'A short sound for new messages and alerts while JM is open (not for the chat you are reading, or muted chats).', vibrate_enabled: 'A short vibration on this phone for new messages and alerts.', mentions_override_mute: 'You still hear when someone @mentions you in a muted chat.', jp_push: 'Pushes for Passwords requests and approvals.' } as const
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function PreferencesForm() {
  const c = useColors(); const [p, setP] = useState<notifications.Preferences | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false)
  const [quiet, setQuiet] = useState<{ start: string; end: string } | null>(null)
  useEffect(() => { let active = true; notifications.getPreferences().then(value => { if (active) setP(value) }).catch(e => { if (active) setError(errorMessage(e)) }); return () => { active = false } }, [])
  async function save(data: Partial<notifications.Preferences>, after?: () => void) { if (!p) return; setBusy(true); setError(''); setSaved(false); try { setP(await notifications.updatePreferences(data)); setSaved(true); after?.() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  const start = quiet?.start ?? p?.dnd_start?.slice(0, 5) ?? ''; const end = quiet?.end ?? p?.dnd_end?.slice(0, 5) ?? ''
  const valid = [start, end].every(v => !v || HHMM.test(v)) && Boolean(start) === Boolean(end)
  return <Section title="Notifications" aside={saved ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: font.r, fontSize: 12, color: c.success }}>Saved</Text> : undefined}>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: font.r, fontSize: 14, marginBottom: 12 }}>{error}</Text>}
    {!p && !error && <View style={{ padding: 16 }}><Spinner label="Loading preferences" /></View>}
    {p && <View style={{ gap: 20 }}>
      <Check label="Send push notifications" description={PREF_DESCRIPTION.push_enabled} value={p.push_enabled} disabled={busy} onChange={v => void save({ push_enabled: v })} />
      <View style={{ zIndex: 5 }}>
        <Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>Message preview</Text>
        <View style={{ marginBottom: 6 }}><Muted>Others near your screen may see notifications. Each chat can override this in its menu → Notifications.</Muted></View>
        <Select label="Message preview" height={40} value={p.push_preview} disabled={busy} style={{ maxWidth: 384 }} onChange={v => void save({ push_preview: v })} options={(['none', 'sender', 'sender_and_text'] as const).map(value => ({ value, label: PREVIEW_LABEL[value] }))} />
      </View>
      <Check label="Enable message sound" description={PREF_DESCRIPTION.sound_enabled} value={p.sound_enabled} disabled={busy} onChange={v => void save({ sound_enabled: v })} />
      <Check label="Vibrate for new messages" description={PREF_DESCRIPTION.vibrate_enabled} value={p.vibrate_enabled} disabled={busy} onChange={v => void save({ vibrate_enabled: v })} />
      <Check label="Mentions break through muted chats" description={PREF_DESCRIPTION.mentions_override_mute} value={p.mentions_override_mute} disabled={busy} onChange={v => void save({ mentions_override_mute: v })} />
      <Check label="Passwords notifications" description={PREF_DESCRIPTION.jp_push} value={p.jp_push} disabled={busy} onChange={v => void save({ jp_push: v })} />
      <View>
        <Text style={{ marginBottom: 6, fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>Quiet hours</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
          {(['start', 'end'] as const).map(key => <View key={key} style={{ width: 128, gap: 6 }}><Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>{key === 'start' ? 'From' : 'To'}</Text>
            <TimeField label={`Quiet hours ${key}`} disabled={busy} value={key === 'start' ? start : end} onChange={v => setQuiet({ start: key === 'start' ? v : start, end: key === 'end' ? v : end })} /></View>)}
          <ToolButton label="Save" a11y="Save preferences" disabled={busy || !quiet || !valid} onPress={() => void save({ dnd_start: start || null, dnd_end: end || null }, () => setQuiet(null))} />
          {(p.dnd_start || quiet) && <ToolButton variant="ghost" label="Turn off" a11y="Turn off quiet hours" disabled={busy} onPress={() => void save({ dnd_start: null, dnd_end: null }, () => setQuiet(null))} />}
        </View>
        <View style={{ marginTop: 4 }}><Muted>No pushes in this time (India time). Sign-in alerts still arrive.</Muted></View>
      </View>
    </View>}
  </Section>
}

function Privacy() {
  const c = useColors(); const { me, adopt } = useSession(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  if (!me) return null
  return <Section title="Privacy" z={3}>
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>Who can see when I’m online and last seen</Text>
      <Select label="Who can see when I’m online and last seen" height={40} value={me.last_seen_privacy} disabled={busy} onChange={v => { setBusy(true); setError(''); void notifications.updatePrivacy(v).then(() => adopt()).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }}
        options={[{ value: 'everyone', label: 'Everyone' }, { value: 'contacts', label: 'People I chat with' }, { value: 'nobody', label: 'Nobody' }]} />
      {error ? <Text accessibilityRole="alert" style={{ fontFamily: font.r, fontSize: 12, color: c.danger }}>{error}</Text> : <Muted>If you choose “Nobody”, you won’t see other people’s either.</Muted>}
    </View>
  </Section>
}

function SettingsTab() {
  const { width } = useWindowDimensions(); const two = width >= 1024
  return <View style={{ flexDirection: two ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
    <View style={{ gap: 20, flex: two ? 1 : undefined, width: two ? undefined : '100%', minWidth: 0, zIndex: 2 }}>
      <Section title="This device" z={4}><DevicePush /></Section>
      <Privacy />
    </View>
    <View style={{ flex: two ? 1 : undefined, width: two ? undefined : '100%', minWidth: 0, zIndex: 1 }}><PreferencesForm /></View>
  </View>
}

export function ActivityPanel({ initialView }: { initialView?: string }) {
  const [tab, setTab] = useState<'notifications' | 'alerts'>(initialView === 'alerts' ? 'alerts' : 'notifications')
  const [settings, setSettings] = useState(false)
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { gap: 0 }]}>
    <PageHeader title="Notifications" subtitle="What reached you, and what reaches you where." />
    <UnderlineTabs asButtons label="Notifications" value={settings ? 'settings' as const : tab} onChange={value => { if (value === 'settings') { setTab('notifications'); setSettings(true) } else { setSettings(false); setTab(value) } }}
      tabs={[{ value: 'notifications', label: 'Notifications' }, { value: 'alerts', label: 'Alerts' }, { value: 'settings', label: 'Settings', accessibilityLabel: 'Notification preferences' }]} />
    {settings ? <SettingsTab /> : tab === 'notifications' ? <NotificationList /> : <AlertsPanel />}
  </ScrollView>
}
