import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text } from 'react-native'
import { Button, Label, Card, styles } from '../ui'
import { errorMessage } from '../core/api/client'
export function ResourceList<T>({ title, load, render, keyOf }: {
  title: string; load: () => Promise<T[]>; render: (item: T) => React.ReactNode; keyOf: (item: T) => string
}) {
  const [items, setItems] = useState<T[]>([]); const [busy, setBusy] = useState(true)
  const [error, setError] = useState(''); const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    load().then(data => { if (active) setItems(data) }).catch(e => { if (active) setError(errorMessage(e)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [load, revision])
  return <ScrollView contentContainerStyle={styles.page}><Label large>{title}</Label>
    <Button title="Refresh" onPress={() => { setBusy(true); setError(''); setRevision(v => v + 1) }} disabled={busy} />
    {busy && <ActivityIndicator />}
    {!!error && <Text accessibilityRole="alert">{error}</Text>}
    {!busy && !error && !items.length && <Label>Nothing here yet.</Label>}
    {items.map(item => <Card key={keyOf(item)}>{render(item)}</Card>)}
  </ScrollView>
}
