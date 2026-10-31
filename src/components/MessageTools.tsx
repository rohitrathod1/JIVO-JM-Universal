import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Image, Switch, Text } from 'react-native'
import { randomUUID } from 'expo-crypto'
import * as chat from '../modules/messenger/api'
import { errorMessage, origin } from '../core/api/client'
import { useCursor } from '../shared/useCursor'
import { Button, Card, Field, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
export function SearchMessages({ conversation, onJump, onClose }: { conversation: string; onJump: (seq: number) => void; onClose: () => void }) {
  const c = useColors(); const [query, setQuery] = useState(''); const [submitted, setSubmitted] = useState('')
  const load = useCallback(async (cursor?: string | null) => { if (!submitted.trim()) return { results: [], next_cursor: null }; const page = await chat.searchMessages(submitted, cursor, conversation); return { ...page, results: page.results.map(hit => ({ ...hit, id: hit.message.id })) } }, [submitted, conversation]); const page = useCursor(load)
  return <Sheet visible onClose={onClose}><Label large>Search this conversation</Label><Field label="Search messages" value={query} onChangeText={setQuery} /><Button title="Find messages" disabled={!query.trim()} onPress={() => setSubmitted(query)} />
    {page.items.map(hit => <Card key={hit.id}><Label>{hit.message.sender?.name}</Label><Label>{hit.message.body}</Label><Label>{new Date(hit.message.created_at).toLocaleString()}</Label><Button title="Jump to message" onPress={() => { onJump(hit.message.seq); onClose() }} /></Card>)}
    {page.loading && <ActivityIndicator />}{!!page.error && <Text accessibilityRole="alert" style={{ color: c.text }}>{page.error}</Text>}{Boolean(submitted) && !page.loading && !page.items.length && <Label>No matching messages.</Label>}{page.cursor && <Button title="More matching messages" disabled={page.loading} onPress={() => void page.more()} />}<Button title="Close search" onPress={onClose} />
  </Sheet>
}
export function ForwardMessage({ message, onClose }: { message: chat.Message; onClose: () => void }) {
  const c = useColors(); const [query, setQuery] = useState(''); const [targets, setTargets] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const id = useRef(randomUUID())
  const load = useCallback((cursor?: string | null) => chat.listConversations('all', query, cursor), [query]); const page = useCursor(load)
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>Forward message</Label><Label>{message.body}</Label><Field label="Find destination conversation" value={query} onChangeText={setQuery} />
    {page.items.map(item => <Button key={item.id} title={`${targets.includes(item.id) ? 'Selected: ' : ''}${item.title || item.peer?.name || 'Conversation'}`} disabled={busy || !item.can.send} onPress={() => { setTargets(ids => ids.includes(item.id) ? ids.filter(i => i !== item.id) : [...ids, item.id]); id.current = randomUUID() }} />)}
    {page.cursor && <Button title="More destinations" disabled={page.loading} onPress={() => void page.more()} />}{!!(error || page.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || page.error}</Text>}
    <Button title={`Forward to ${targets.length} conversations`} disabled={busy || !targets.length} onPress={() => { setBusy(true); void chat.forwardMessage(message.id, targets, id.current).then(onClose).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} /><Button title="Cancel forward" disabled={busy} onPress={onClose} />
  </Sheet>
}
export function CreatePoll({ conversation, onSent, onClose }: { conversation: string; onSent: (message: chat.Message) => void; onClose: () => void }) {
  const c = useColors(); const [question, setQuestion] = useState(''); const [options, setOptions] = useState(''); const [multiple, setMultiple] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const id = useRef(randomUUID())
  const values = options.split('\n').map(v => v.trim()).filter(Boolean)
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>Create a poll</Label><Field label="Poll question" value={question} onChangeText={value => { setQuestion(value); id.current = randomUUID() }} /><Field label="Poll choices (one per line)" multiline value={options} onChangeText={value => { setOptions(value); id.current = randomUUID() }} /><Label>Allow multiple choices</Label><Switch accessibilityLabel="Allow multiple poll choices" value={multiple} onValueChange={value => { setMultiple(value); id.current = randomUUID() }} />
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}<Button title="Send poll" disabled={busy || !question.trim() || values.length < 2 || new Set(values).size !== values.length} onPress={() => { setBusy(true); void chat.createPoll(conversation, { client_id: id.current, question: question.trim(), options: values, allow_multiple: multiple }).then(onSent).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} /><Button title="Cancel poll" disabled={busy} onPress={onClose} />
  </Sheet>
}
export function ShareContact({ conversation, onSent, onClose }: { conversation: string; onSent: (message: chat.Message) => void; onClose: () => void }) {
  const c = useColors(); const [query, setQuery] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [selected, setSelected] = useState<chat.PersonCard | null>(null); const id = useRef(randomUUID())
  const load = useCallback((cursor?: string | null) => chat.searchPeople(query, cursor), [query]); const page = useCursor(load)
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>Share a contact</Label><Field label="Find a contact" value={query} onChangeText={setQuery} />{page.items.map(person => <Button key={person.id} title={`${selected?.id === person.id ? 'Selected: ' : ''}${person.name}`} disabled={busy} onPress={() => { setSelected(person); id.current = randomUUID() }} />)}{page.cursor && <Button title="More contacts" disabled={page.loading} onPress={() => void page.more()} />}
    {!!(error || page.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || page.error}</Text>}<Button title="Send contact" disabled={busy || !selected} onPress={() => { if (!selected) return; setBusy(true); void chat.sendContact(conversation, id.current, selected.id).then(onSent).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} /><Button title="Cancel contact" disabled={busy} onPress={onClose} />
  </Sheet>
}
export function FullImage({ attachment, onClose }: { attachment: chat.Attachment; onClose: () => void }) {
  const path = attachment.preview_url || attachment.download_url
  const valid = path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
  return <Sheet visible onClose={onClose}><Label large>{attachment.name}</Label>{valid ? <Image accessibilityLabel={attachment.name} source={{ uri: `${origin}${path}` }} style={{ width: '100%', aspectRatio: Math.max(0.5, Math.min(2, (attachment.width || 1) / (attachment.height || 1))) }} resizeMode="contain" /> : <Label>This image URL is unsupported.</Label>}<Button title="Close image" onPress={onClose} /></Sheet>
}

