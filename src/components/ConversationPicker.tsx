import { useCallback, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { createGroup, openDirect, searchPeople, type ConversationItem, type PersonCard } from '../modules/messenger/api'
import { Button, Card, Field, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
import { useCursor } from '../shared/useCursor'
import { errorMessage } from '../core/api/client'
export function ConversationPicker({ groupAllowed, onChoose, onClose }: { groupAllowed: boolean; onChoose: (value: ConversationItem) => void; onClose: () => void }) {
  const c = useColors(); const [query, setQuery] = useState('')
  const [group, setGroup] = useState(false); const [title, setTitle] = useState(''); const [members, setMembers] = useState<string[]>([])
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback((cursor?: string | null) => searchPeople(query, cursor), [query])
  const page = useCursor(load)
  const { items: people, cursor } = page
  async function choose(person: PersonCard) {
    if (group) { setMembers(ids => ids.includes(person.id) ? ids.filter(id => id !== person.id) : [...ids, person.id]); return }
    setBusy(true); setError('')
    try { onChoose(await openDirect(person.id)) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function create() {
    setBusy(true); setError('')
    try { onChoose(await createGroup({ title: title.trim(), member_ids: members })) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <Sheet visible onClose={() => { if (!busy) onClose() }}>
      <Label large>{group ? 'Create a group' : 'New conversation'}</Label>
      {groupAllowed && <Button title={group ? 'Direct conversation' : 'Create a group instead'} disabled={busy} onPress={() => setGroup(v => !v)} />}
      {group && <Field label="Group name" value={title} onChangeText={setTitle} maxLength={150} />}
      <Field label="Find people" value={query} onChangeText={setQuery} />
      {!!(error || page.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || page.error}</Text>}
      {busy && <ActivityIndicator />}
      <View style={{ gap: 10 }}>
        {people.map(p => <Card key={p.id}><Label>{p.name}</Label><Label>{p.company}</Label><Button title={group ? members.includes(p.id) ? 'Remove selection' : 'Select person' : `Chat with ${p.name}`} disabled={busy || !p.is_active} onPress={() => void choose(p)} /></Card>)}
        {cursor && <Button title="More people" disabled={page.loading} onPress={() => void page.more()} />}
      </View>
      {group && <Button title={`Create group (${members.length} selected)`} disabled={busy || !title.trim() || !members.length} onPress={() => void create()} />}
      <Button title="Close" onPress={onClose} disabled={busy} />
  </Sheet>
}
