import { useSyncExternalStore } from 'react'
import { Text, View } from 'react-native'
import { Icon } from '../../../components/Icon'
import { Button, useColors } from '../../../ui'
import { chatLock } from '../chatLock'

export function LockedChatsGate({ title = 'Locked chat', onUnlocked }: { title?: string; onUnlocked?: () => void }) {
  const colors = useColors()
  const state = useSyncExternalStore(chatLock.subscribe, chatLock.snapshot, chatLock.snapshot)
  return <View style={{ flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={28} color={colors.brand} /></View>
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26, textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: colors.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>This chat is locked.</Text>
    </View>
    {Boolean(state.error) && <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: 'center' }}>{state.error}</Text>}
    <Button title={state.busy ? 'Verifying…' : 'Unlock'} disabled={state.busy} onPress={() => { void chatLock.unlock().then(ok => { if (ok) onUnlocked?.() }) }} />
  </View>
}
