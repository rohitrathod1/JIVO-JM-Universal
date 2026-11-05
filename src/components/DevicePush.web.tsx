// Reference NotificationsPage "This device" section (web push): bell-ring icon, medium title, muted hint, Turn on / Turn off.
import { useState, useSyncExternalStore } from 'react'
import { Text, View } from 'react-native'
import { webPush } from '../modules/notifications/webPush.web'
import { useColors } from '../ui'
import { Icon } from './Icon'
import { Muted, ToolButton, font } from './InboxVaultKit'

export function DevicePush() {
  const state = useSyncExternalStore(webPush.subscribe, webPush.snapshot, webPush.snapshot); const c = useColors(); const [sent, setSent] = useState<number | null>(null)
  const hint = state.support === 'unsupported' ? 'This browser cannot show notifications from JM.'
    : state.support === 'denied' ? 'Notifications are blocked for JM. Allow them in the browser’s site settings, then come back.'
    : state.support === 'ios-install' ? 'On iPhone and iPad, first add JM to your Home Screen (Share → Add to Home Screen), then open it from there.'
    : state.enabled ? 'New messages and mentions reach this device when JM is closed.' : 'Get new messages and mentions on this device when JM is closed.'
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ marginTop: 2 }}><Icon name="bellRing" size={20} color={c.brand} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>Push notifications</Text>
        <Muted>{hint}</Muted>
      </View>
      {state.support === 'supported' && <ToolButton variant={state.enabled ? 'secondary' : 'primary'} height={32} label={state.enabled ? 'Turn off' : state.busy ? 'Turning on…' : 'Turn on'} a11y={state.enabled ? 'Disable device notifications' : 'Enable device notifications'} disabled={state.busy || !state.owner}
        onPress={() => { setSent(null); void (state.enabled ? webPush.disable() : webPush.enable()) }} />}
    </View>
    {!!state.error && <Text accessibilityRole="alert" style={{ fontFamily: font.r, fontSize: 12, color: c.danger }}>{state.error}</Text>}
    {state.enabled && <View style={{ alignSelf: 'flex-start' }}><ToolButton variant="ghost" icon="bellRing" height={32} label="Send a test notification" a11y="Send test notification" disabled={state.busy} onPress={() => { void webPush.test().then(setSent) }} /></View>}
    {sent !== null && <Muted>{`Test sent to ${sent} device${sent === 1 ? '' : 's'}. It should appear in a few seconds.`}</Muted>}
  </View>
}
