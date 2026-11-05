import { useState, useSyncExternalStore } from 'react'
import { Text, View } from 'react-native'
import { webPush } from '../modules/notifications/webPush.web'
import { Button, Label, useColors } from '../ui'
export function PushSettings() {
  const state = useSyncExternalStore(webPush.subscribe, webPush.snapshot, webPush.snapshot); const c = useColors(); const [sent, setSent] = useState<number | null>(null)
  return <View style={{ gap: 10 }}><Label large>Notifications on this device</Label>
    <Label>{state.support === 'ios-install' ? 'In Safari, add JM to your Home Screen, then enable notifications in the installed app.' : state.support === 'unsupported' ? 'This browser cannot safely register push notifications. Use the installed app in a supported browser over HTTPS or localhost.' : state.support === 'denied' ? 'Notifications are blocked in this browser’s site settings. Allow them there, then try again.' : state.enabled ? 'Background notifications are enabled for this account on this device.' : 'Enable background notifications for this account on this device.'}</Label>
    {!!state.error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{state.error}</Text>}
    {state.enabled ? <><Button title="Disable device notifications" disabled={state.busy} onPress={() => { setSent(null); void webPush.disable() }} /><Button variant="secondary" title="Send test notification" disabled={state.busy} onPress={() => { void webPush.test().then(setSent) }} /></> : <Button title={state.busy ? 'Enabling notifications…' : 'Enable device notifications'} disabled={state.busy || !state.owner || state.support !== 'supported'} onPress={() => { setSent(null); void webPush.enable() }} />}
    {sent !== null && <Label>Test requested for {sent} registered device{sent === 1 ? '' : 's'}.</Label>}
  </View>
}
