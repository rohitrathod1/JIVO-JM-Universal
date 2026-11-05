import { useEffect, useState, useSyncExternalStore } from 'react'
import { View } from 'react-native'
import { SecretCopyController } from '../modules/passwords/copyController'
import { reportCopy } from '../modules/passwords/api'
import { clearClipboardIfUnchanged } from '../modules/passwords/clipboardClear'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { CopyIconButton, CopyNote } from './SecretCopyButton'
// Reference clearClipboardSoon: browsers only allow clipboard writes from a focused document,
// so wait for focus. Read back only when already permitted (no prompt); otherwise clear as the reference does.
const clearWebClipboard = (value: string) => clearClipboardIfUnchanged({
  read: async () => { const status = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName }).catch(() => null); return status?.state === 'granted' ? navigator.clipboard.readText() : undefined },
  write: text => navigator.clipboard.writeText(text),
  canAccess: () => document.hasFocus(),
  onAccess: fn => { window.addEventListener('focus', fn); return () => window.removeEventListener('focus', fn) },
}, value)
export function SecretCopy({ value, entryId, field }: { value: string; entryId: string; field: string }) {
  const [copy] = useState(() => new SecretCopyController({ write: text => navigator.clipboard.writeText(text), report: () => reportCopy(entryId, field), clear: clearWebClipboard })); const state = useSyncExternalStore(copy.subscribe, copy.snapshot, copy.snapshot)
  useEffect(() => { const off = subscribeSensitiveView(copy.setActive); return () => { off(); copy.setActive(false) } }, [copy]); const available = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ flex: 1, minWidth: 0 }}><CopyNote>{state.notice || (available ? 'Copying places this value on the system clipboard. It is cleared after 30 seconds if unchanged.' : 'Clipboard writing is unavailable in this browser context.')}</CopyNote></View>
    <CopyIconButton field={field} disabled={!available || state.busy} onPress={() => void copy.copy(value)} />
  </View>
}
