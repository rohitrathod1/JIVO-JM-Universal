import { vaultSession } from '../modules/passwords/session'
import { StepUpPrompt } from './StepUp'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useSession } from '../core/auth/Session'
import { watchVaultActivity } from '../modules/passwords/activity'
import { Button, Surface, useColors } from '../ui'
import { Icon } from './Icon'
import { font } from './InboxVaultKit'

/** Reference LockGate: centred max-w-md surface, 40px brand lock, "Passwords are locked", Unlock. */
function Locked({ title, body, error, action }: { title: string; body: string; error?: string; action?: ReactNode }) {
  const c = useColors()
  return <View style={{ paddingHorizontal: 16, paddingTop: 32 }}><Surface style={{ width: '100%', maxWidth: 448, alignSelf: 'center', padding: 32, alignItems: 'center' }}>
    <Icon name="lockKeyhole" size={40} color={c.brand} />
    <Text accessibilityRole="header" style={{ marginTop: 16, fontFamily: font.s, fontWeight: '600', fontSize: 18, lineHeight: 28, color: c.text, textAlign: 'center' }}>{title}</Text>
    <Text style={{ marginTop: 8, fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center' }}>{body}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ marginTop: 12, fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.danger, textAlign: 'center' }}>{error}</Text>}
    {action && <View style={{ marginTop: 24 }}>{action}</View>}
  </Surface></View>
}
function Gate({ children, owner }: { children: ReactNode; owner: string }) {
  const [{ lock, fallback }] = useState(() => vaultSession(owner))
  const state = useSyncExternalStore(lock.subscribe, lock.snapshot, lock.snapshot)
  useEffect(() => { lock.start(); const off = watchVaultActivity(lock.touch, lock.check); return () => { off(); lock.stop(); fallback.clear() } }, [lock, fallback])
  return <><StepUpPrompt flow={fallback}/>{state.unlocked ? <View style={{ flex: 1 }} onTouchStart={lock.touch}>
    {children}
  </View> : <Locked title="Passwords are locked" body="Confirm your identity to open Passwords. It locks after 10 minutes of inactivity." error={state.error || undefined} action={<Button title="Unlock" loading={state.busy} disabled={state.busy} onPress={() => void lock.open()} />} />}</>
}
export function VaultGate({ children }: { children: ReactNode }) {
  const { me } = useSession()
  const allowed = me?.capabilities.some(c => ['JP_ACCESS', 'JP_MANAGE_VAULT', 'JP_BREAK_GLASS', 'JP_REQUEST_EMERGENCY'].includes(c))
  return allowed ? <Gate owner={me!.id + ':' + (me!.session?.id ?? 'none')} key={me!.id + ':' + (me!.session?.id ?? 'none')}>{children}</Gate> : <Locked title="Passwords" body="Passwords access is not enabled for your account." />
}
