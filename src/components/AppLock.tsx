import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ActivityIndicator, AppState, Platform, View } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useSession } from '../core/auth/Session'
import { NativeAppLock } from '../core/auth/nativeAppLock'
import { Button, Card, Label, useColors } from '../ui'

const Context = createContext<NativeAppLock | null>(null)
export function AppLock({ children }: { children: ReactNode }) {
  const { me, status } = useSession()
  return status === 'ready' && me ? <AccountLock key={me.id} account={me.id}>{children}</AccountLock> : <>{children}</>
}
function AccountLock({ account, children }: { account: string; children: ReactNode }) {
  const { logout } = useSession(); const colors = useColors()
  const [model] = useState(() => new NativeAppLock({
    read: async () => (await SecureStore.getItemAsync(`jm.lock.${account}`)) === '1',
    write: enabled => SecureStore.setItemAsync(`jm.lock.${account}`, enabled ? '1' : '0', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    authenticate: async () => (await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock JIVO JM', cancelLabel: 'Cancel', biometricsSecurityLevel: 'strong' })).success,
    cancel: () => { if (Platform.OS === 'android') void LocalAuthentication.cancelAuthenticate().catch(() => {}) },
  }))
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot)
  const [foreground, setForeground] = useState(AppState.currentState === 'active')
  useEffect(() => {
    void model.restore()
    const sub = AppState.addEventListener('change', next => { setForeground(next === 'active'); if (next === 'background') model.background() })
    return () => { sub.remove(); model.dispose() }
  }, [model])
  const cover = !state.ready || (state.enabled && (state.locked || !foreground))
  // Preserve an already-open screen beneath the privacy cover. Native system
  // pickers temporarily background JM; unmounting loses their reviewed result.
  return <Context.Provider value={model}>{(state.opened || !cover) && <View style={{ flex: 1, display: cover ? 'none' : 'flex' }} accessibilityElementsHidden={cover} importantForAccessibility={cover ? 'no-hide-descendants' : 'auto'}>{children}</View>}{cover && <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.bg }}>
    <Label large>JIVO JM is locked</Label>
    {!!state.error && <Label>{state.error}</Label>}
    {state.busy && <ActivityIndicator />}
    <Button title={state.ready ? 'Unlock with device security' : 'Retry lock settings'} disabled={state.busy} onPress={() => { void (state.ready ? model.verify() : model.restore()) }} />
    <Button title="Sign out" disabled={state.busy} onPress={() => void logout().catch(() => {})} />
  </View>}</Context.Provider>
}
export function AppLockSetting() {
  const model = useContext(Context)
  return model ? <LockSetting model={model} /> : null
}
function LockSetting({ model }: { model: NativeAppLock }) {
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot)
  return <Card><Label large>Device app lock</Label><Label>Require device verification when opening JM or returning from the background. This privacy screen does not replace server sign-in or two-step verification.</Label>
    {!!state.error && <Label>{state.error}</Label>}
    <Button title={state.enabled ? 'Turn off app lock' : 'Turn on app lock'} disabled={!state.ready || state.busy} onPress={() => void model.verify(!state.enabled)} />
  </Card>
}
