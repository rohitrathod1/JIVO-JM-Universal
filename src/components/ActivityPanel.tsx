import { router } from 'expo-router'
import { notificationTarget } from '../shared/notificationTarget'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Switch, Text, View } from 'react-native'
import * as notifications from '../modules/notifications/api'
import { useCursor } from '../shared/useCursor'
import { Button, Card, Field, Label, styles, useColors } from '../ui'
import { errorMessage } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { AlertsPanel } from './AlertsPanel'
import { Sheet } from './Sheet'
function NotificationList() {
  const c = useColors(); const [state, setState] = useState<notifications.ReadFilter>('all'); const [kind, setKind] = useState<notifications.KindFilter>('all')
  const load = useCallback((cursor?: string | null) => notifications.listNotifications(cursor, 30, { state, kind }), [state, kind]); const page = useCursor(load)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [selected, setSelected] = useState<notifications.AppNotification | null>(null)
  const [confirmation, setConfirmation] = useState<notifications.AppNotification | null>(null); const [preferences, setPreferences] = useState<notifications.Preferences | null>(null)
  const [settings, setSettings] = useState(false); const refresh = page.refresh
  useEffect(() => realtime.on('*', frame => { if (frame.type.startsWith('NOTIFICATION_')) void refresh() }), [refresh])
  async function run(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action(); await refresh(); setConfirmation(null) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  async function openSettings() { setBusy(true); setError(''); try { setPreferences(await notifications.getPreferences()); setSettings(true) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Label large>Activity</Label>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['all', 'unread', 'read'] as const).map(value => <Button key={value} title={value === state ? `${value} selected` : value} disabled={busy} onPress={() => setState(value)} />)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['all', 'messages', 'alerts'] as const).map(value => <Button key={value} title={value === kind ? `${value} selected` : value} disabled={busy} onPress={() => setKind(value)} />)}</View>
    <Button title="Notification preferences" disabled={busy} onPress={() => void openSettings()} /><Button title="Mark all as read" disabled={busy} onPress={() => void run(() => notifications.markNotificationsRead('all'))} />
    {!!(error || page.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || page.error}</Text>}
    {page.items.map(n => <Card key={n.id}><Label large>{n.title}</Label><Label>{n.body}</Label><Label>{n.read_at ? 'Read' : 'Unread'} · {new Date(n.created_at).toLocaleString()}</Label>
      <Button title={`Open ${n.title}`} disabled={busy} onPress={() => { setSelected(n); if (!n.read_at) void run(() => notifications.markNotificationsRead([n.id])) }} />
      {!n.read_at && <Button title="Mark read" disabled={busy} onPress={() => void run(() => notifications.markNotificationsRead([n.id]))} />}<Button title="Remove notification" disabled={busy} onPress={() => setConfirmation(n)} />
    </Card>)}
    {(busy || page.loading) && <ActivityIndicator />}{!page.loading && !page.items.length && <Label>No notifications match these filters.</Label>}
    {page.cursor && <Button title="More notifications" disabled={page.loading} onPress={() => void page.more()} />}
    <Sheet visible={Boolean(selected)} onClose={() => setSelected(null)}><Label large>{selected?.title}</Label><Label>{selected?.body}</Label>{selected?.link && (notificationTarget(selected.link) ? <Button title="Go to linked item" onPress={() => { const target = notificationTarget(selected.link); if (target) { setSelected(null); router.push(target) } }} /> : <Label>This notification destination is not available in this client.</Label>)}<Button title="Close notification" onPress={() => setSelected(null)} /></Sheet>
    <Sheet visible={Boolean(confirmation)} onClose={() => { if (!busy) setConfirmation(null) }}><Label>Remove this notification from your activity?</Label><Button title="Confirm removal" disabled={busy} onPress={() => { if (confirmation) void run(() => notifications.deleteNotifications([confirmation.id])) }} /><Button title="Cancel" disabled={busy} onPress={() => setConfirmation(null)} /></Sheet>
    <Sheet visible={settings} onClose={() => { if (!busy) setSettings(false) }}><Label large>Notification preferences</Label>
      {preferences && <>{(['sound_enabled', 'vibrate_enabled', 'mentions_override_mute', 'jp_push'] as const).map(key => <View key={key} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ flex: 1 }}><Label>{key.replaceAll('_', ' ')}</Label></View><Switch accessibilityLabel={key.replaceAll('_', ' ')} value={preferences[key]} onValueChange={value => setPreferences({ ...preferences, [key]: value })} /></View>)}
        <Label>Push preview</Label>{(['none', 'sender', 'sender_and_text'] as const).map(value => <Button key={value} title={`${value.replaceAll('_', ' ')}${value === preferences.push_preview ? ' selected' : ''}`} onPress={() => setPreferences({ ...preferences, push_preview: value })} />)}
        <Field label="Quiet hours start (HH:MM)" value={preferences.dnd_start ?? ''} onChangeText={value => setPreferences({ ...preferences, dnd_start: value || null })} /><Field label="Quiet hours end (HH:MM)" value={preferences.dnd_end ?? ''} onChangeText={value => setPreferences({ ...preferences, dnd_end: value || null })} />
        <Button title="Save preferences" disabled={busy || [preferences.dnd_start, preferences.dnd_end].some(v => v !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))} onPress={() => void run(async () => { setPreferences(await notifications.updatePreferences(preferences)); setSettings(false) })} />
      </>}<Label>Device push registration is not yet connected in this client.</Label><Button title="Close preferences" disabled={busy} onPress={() => setSettings(false)} />
    </Sheet>
  </ScrollView>
}

export function ActivityPanel({ initialView }: { initialView?: string }) {
  const [tab, setTab] = useState<'notifications' | 'alerts'>(initialView === 'alerts' ? 'alerts' : 'notifications')
  return <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', gap: 8, padding: 12 }}><Button title="Notifications" onPress={() => setTab('notifications')} /><Button title="Alerts" onPress={() => setTab('alerts')} /></View>{tab === 'notifications' ? <NotificationList /> : <AlertsPanel />}</View>
}
