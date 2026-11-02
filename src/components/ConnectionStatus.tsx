import { useSyncExternalStore } from 'react'
import { Platform, Text, View } from 'react-native'
import { realtime } from '../core/realtime/socket'
import { useColors } from '../ui'

export function ConnectionStatus() {
  const status = useSyncExternalStore(realtime.subscribe, realtime.snapshot, realtime.snapshot)
  const colors = useColors()
  const text = status === 'offline' ? 'Offline. Queued messages will retry when you reconnect.'
    : status === 'connecting' || status === 'reconnecting' ? 'Connecting to live updates…'
    : status === 'forbidden' ? 'Live updates are unavailable for this account. Refresh your session.' : ''
  return text ? <View style={{ padding: 8, backgroundColor: colors.panel }}><Text accessibilityRole={Platform.OS === 'web' ? 'status' : undefined} accessibilityLiveRegion="polite" style={{ color: colors.text }}>{text}</Text></View> : null
}
