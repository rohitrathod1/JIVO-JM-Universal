import { useSession } from '../core/auth/Session'
import { useEffect, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { Button, useColors } from '../ui'
import { Icon } from './Icon'
import { Muted, font } from './InboxVaultKit'
import { nativePushState, registerNativePush, disableNativePush, pushProjectId, testLocalNotification } from '../modules/notifications/nativePush'
import { api, errorMessage } from '../core/api/client'
export function DevicePush() {
  const { me } = useSession(); const c = useColors(); const [subscribed, setSubscribed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => { let alive = true; void nativePushState().then(s => { if (alive) setSubscribed(s.subscribed && s.granted) }).catch(e => { if (alive) setError(errorMessage(e)) }); return () => { alive = false } }, [])
  async function run(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  return <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', gap: 12 }}><Icon name="bellRing" size={22} color={c.brand} /><View style={{ flex: 1 }}><Text style={{ color: c.text, fontFamily: font.m, fontSize: 16 }}>Push notifications</Text><Muted>{subscribed ? 'Enabled on this device through Expo.' : 'Receive message and alert notifications when JM is in the background.'}</Muted></View></View>
    {!pushProjectId() && <Muted>Setup pending: Expo project ID and Android/iOS push credentials.</Muted>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}
    <Button title={subscribed ? 'Turn off on this device' : 'Enable notifications'} disabled={busy || (!subscribed && !pushProjectId())} onPress={() => void run(async () => { if (subscribed) { await disableNativePush(); setSubscribed(false) } else { await registerNativePush(true, me?.id ?? ''); setSubscribed(true) } })} />
    <Button title="Test device notification" variant="secondary" disabled={busy || !me} onPress={() => void run(() => testLocalNotification(me!.id))} />
    {subscribed && <Button title="Send test notification" variant="secondary" disabled={busy} onPress={() => void run(() => api.post('/push/test/'))} />}
    <Button title="Open device notification settings" variant="ghost" onPress={() => void Linking.openSettings()} />
  </View>
}
