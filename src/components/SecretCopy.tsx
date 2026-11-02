import { useEffect, useState, useSyncExternalStore } from 'react'
import { setStringAsync } from 'expo-clipboard'
import { SecretCopyController } from '../modules/passwords/copyController'
import { reportCopy } from '../modules/passwords/api'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { Button, Label } from '../ui'

export function SecretCopy({ value, entryId, field }: { value: string; entryId: string; field: string }) {
  const [copy] = useState(() => new SecretCopyController({
    write: async text => {
      await setStringAsync(text, { android: { isSensitive: true }, ios: { localOnly: true, expiresAt: new Date(Date.now() + 30000) } })
    },
    report: () => reportCopy(entryId, field),
  }))
  const state = useSyncExternalStore(copy.subscribe, copy.snapshot, copy.snapshot)
  useEffect(() => { const off = subscribeSensitiveView(copy.setActive); return () => { off(); copy.setActive(false) } }, [copy])
  return <><Label>Copied values may remain in clipboard history. Replace them after use.</Label>
    <Button title={`Copy ${field}`} disabled={state.busy} onPress={() => void copy.copy(value)} />
    {!!state.notice && <Label>{state.notice}</Label>}</>
}
