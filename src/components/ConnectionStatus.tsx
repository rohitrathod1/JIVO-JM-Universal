import { useState, useSyncExternalStore } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { realtime } from '../core/realtime/socket'
import { Button, Label, useColors } from '../ui'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

/** `reconnecting`: the caller already retries on reconnect/foreground/backoff (session restore), so say so instead of asking for a tap. */
export function ConnectionStatus({ error, onRetry, retrying = false, reconnecting = false }: { error?: string | null; onRetry?: () => void; retrying?: boolean; reconnecting?: boolean }) {
  const status = useSyncExternalStore(realtime.subscribe, realtime.snapshot, realtime.snapshot)
  const c = useColors()
  const [showRetry, setShowRetry] = useState(false)
  const close = () => setShowRetry(false)
  // Offline wins over a network error: retrying cannot help, and the user needs to know sends are queued.
  const networkError = !!error && error.startsWith('Cannot reach JM')
  const text = status === 'offline' && (!error || networkError) ? 'Offline. Messages will send when connected.'
    : error
    ? networkError ? reconnecting ? 'Connection unavailable. Reconnecting automatically; queued messages stay saved on this device.' : 'Connection unavailable. Tap to retry.' : error
    : status === 'offline' ? 'Offline. Messages will send when connected.'
    : status === 'connecting' || status === 'reconnecting' ? 'Reconnecting...'
    : status === 'forbidden' ? 'Live updates unavailable. Refresh your session.' : ''
  if (!text) return null
  return <><View style={{ minHeight: 44, paddingLeft: 12, paddingRight: onRetry ? 4 : 12, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.panel, borderBottomWidth: 1, borderBottomColor: c.border }}>
    <Icon name={status === 'offline' ? 'wifiOff' : 'alert'} size={16} color={c.muted} />
    <Text accessibilityRole={Platform.OS === 'web' ? 'status' : undefined} accessibilityLiveRegion="polite" style={{ flex: 1, color: c.muted, fontSize: 12, lineHeight: 17 }}>{text}</Text>
    {onRetry && <Pressable accessibilityRole="button" accessibilityLabel="Retry connection" accessibilityState={{ disabled: retrying, busy: retrying }} disabled={retrying} onPress={() => setShowRetry(true)} style={({ pressed }) => ({ width: 44, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, opacity: retrying ? 0.45 : pressed ? 0.6 : 1 })}><Icon name="refreshCw" size={18} color={c.brand} /></Pressable>}
  </View>
    <Sheet visible={showRetry} onClose={close} title="Connection issue" bottomAligned
      footer={<><Button title="Not now" size="sm" variant="secondary" onPress={close} /><Button title="Retry" size="sm" loading={retrying} onPress={() => { close(); onRetry?.() }} /></>}>
      <Label>{error || text}</Label>
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>Check your connection and try again. Queued messages stay saved on this device.</Text>
    </Sheet>
  </>
}
