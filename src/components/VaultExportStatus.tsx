import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useSession } from '../core/auth/Session'
import { cancelVaultExports, retryVaultExportCleanup, watchVaultExportCleanup } from '../modules/passwords/files/transfer'
import { Button, Label } from '../ui'
export function VaultExportStatus() {
 const [error, setError] = useState(''); const { status, me } = useSession()
 useEffect(() => watchVaultExportCleanup(setError), [])
 useEffect(() => { if (status !== 'ready') cancelVaultExports(); return cancelVaultExports }, [status, me?.id, me?.session?.id])
 return error ? <View accessibilityRole="alert" style={{padding:12,gap:8}}><Label>{error}</Label><Button title="Retry vault export cleanup" onPress={retryVaultExportCleanup} /></View> : null
}

