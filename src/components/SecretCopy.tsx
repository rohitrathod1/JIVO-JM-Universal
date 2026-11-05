import { useEffect, useState, useSyncExternalStore } from 'react'
import { getStringAsync, setStringAsync } from 'expo-clipboard'
import { AppState, Platform, View } from 'react-native'
import { SecretCopyController } from '../modules/passwords/copyController'
import { reportCopy } from '../modules/passwords/api'
import { clearClipboardIfUnchanged } from '../modules/passwords/clipboardClear'
import { useScreenCaptureGuard } from '../shared/useScreenCaptureGuard'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { CopyIconButton, CopyNote } from './SecretCopyButton'

// iOS already expires the item after 30 s (and reading it back would show the paste banner).
// Android: clear once the app is in the foreground again, only if the clipboard still holds the value.
const clearAndroidClipboard = (value: string) => clearClipboardIfUnchanged({
  read: () => getStringAsync(),
  write: async text => { await setStringAsync(text, { android: { isSensitive: true } }) },
  canAccess: () => AppState.currentState === 'active',
  onAccess: fn => { const sub = AppState.addEventListener('change', next => { if (next === 'active') fn() }); return () => sub.remove() },
}, value)

export function SecretCopy({ value, entryId, field }: { value: string; entryId: string; field: string }) {
  const [copy] = useState(() => new SecretCopyController({
    write: async text => {
      await setStringAsync(text, { android: { isSensitive: true }, ios: { localOnly: true, expiresAt: new Date(Date.now() + 30000) } })
    },
    report: () => reportCopy(entryId, field),
    clear: Platform.OS === 'android' ? clearAndroidClipboard : undefined,
  }))
  // Mounted only while a vault secret is revealed: block screenshots, recording and the recents snapshot.
  useScreenCaptureGuard('capture')
  const state = useSyncExternalStore(copy.subscribe, copy.snapshot, copy.snapshot)
  useEffect(() => { const off = subscribeSensitiveView(copy.setActive); return () => { off(); copy.setActive(false) } }, [copy])
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ flex: 1, minWidth: 0 }}><CopyNote>{state.notice || (Platform.OS === 'ios' ? 'Copied values stay on this device (no Universal Clipboard) and expire from the clipboard after 30 seconds.' : 'Copied values are cleared from the clipboard after 30 seconds but may remain in clipboard history.')}</CopyNote></View>
    <CopyIconButton field={field} disabled={state.busy} onPress={() => void copy.copy(value)} />
  </View>
}
