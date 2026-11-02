import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Image, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { Workspace } from '../components/Workspace'
import { useSession } from '../core/auth/Session'
import { errorMessage } from '../core/api/client'
import { listConversations, type ConversationItem } from '../modules/messenger/api'
import { incomingStorage, incomingShareGeneration, shareController } from '../modules/sharing/incoming'
import { makeSharePlan, shareable, validateIncoming, type IncomingShare } from '../modules/sharing/model'
import type { PickedFile } from '../modules/messenger/media/model'
import { Button, Card, Field, Label, styles, useColors } from '../ui'

function SharedPreview({ file }: { file: PickedFile }) {
  const [uri] = useState(() => file.file ? URL.createObjectURL(file.file) : file.uri)
  useEffect(() => () => { if (uri.startsWith('blob:')) URL.revokeObjectURL(uri) }, [uri])
  return <View style={{ width: 104, gap: 4 }}>{file.mime.startsWith('image/') && !!uri && <Image accessibilityLabel={file.name} source={{ uri }} style={{ width: 96, height: 96, borderRadius: 12 }} resizeMode="cover" />}<Label>{file.name}</Label><Label>{Math.ceil(file.size / 1024)} KB</Label></View>
}
export default function SharePage() {
  const { me, status } = useSession(); const colors = useColors()
  const params = useLocalSearchParams<{ shareError?: string }>()
  const [item, setItem] = useState<IncomingShare | null>(null)
  const [caption, setCaption] = useState(''); const [search, setSearch] = useState('')
  const [chats, setChats] = useState<ConversationItem[]>([]); const [chosen, setChosen] = useState<ConversationItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState(''); const [progress, setProgress] = useState(''); const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (status !== 'ready' || !me) return
    const generation = incomingShareGeneration()
    try { const value = await incomingStorage.read(me.id); if (generation !== incomingShareGeneration()) return; setItem(value); setCaption(value?.plan?.caption ?? value?.caption ?? ''); setChosen([]) }
    catch (cause) { if (generation === incomingShareGeneration()) setError(errorMessage(cause)) }
    finally { if (generation === incomingShareGeneration()) setLoading(false) }
  }, [me, status])
  useEffect(() => { void Promise.resolve().then(load); const subscription = AppState.addEventListener('change', value => { if (value === 'active' && !busyRef.current) void load() }); return () => subscription.remove() }, [load])
  useEffect(() => () => shareController.cancel(), [])
  useEffect(() => {
    if (status !== 'ready' || !me) return
    let active = true
    const generation = incomingShareGeneration()
    const timer = setTimeout(() => { void listConversations('all', search.trim()).then(page => { if (active && generation === incomingShareGeneration()) { setChats(page.results); setCursor(page.next_cursor) } }).catch(cause => { if (active) setError(errorMessage(cause)) }) }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [me, search, status])
  const discard = async () => { shareController.cancel(); await incomingStorage.clear(item?.id); setItem(null); router.replace('/messenger') }
  const send = async () => {
    if (!item || !me || busyRef.current || item.owner !== me.id) return
    const generation = incomingShareGeneration()
    busyRef.current = true; setBusy(true); setError('')
    try {
      validateIncoming(item)
      const plan = item.plan ?? makeSharePlan(caption, item.files, chosen, randomUUID)
      const current = { ...item, caption: plan.caption, plan }; setItem(current)
      await shareController.send(current, plan, setProgress)
      if (generation !== incomingShareGeneration()) return
      await incomingStorage.clear(item.id); setItem(null); router.replace('/messenger')
    } catch (cause) { if (generation === incomingShareGeneration()) setError(errorMessage(cause)) }
    finally { busyRef.current = false; setBusy(false); setProgress('') }
  }
  const targets = chats.filter(chat => shareable(chat, Boolean(item?.files.length)))
  if (item && item.owner !== me?.id) return <Workspace><Label>Loading shared items…</Label></Workspace>
  return <Workspace><ScrollView contentContainerStyle={[styles.page, { width: '100%', maxWidth: 720, alignSelf: 'center' }]}><Label large>Share to JM</Label>
    {!!params.shareError && <Label>{params.shareError === 'limit' ? 'Incoming shares support up to 10 files, 50 MB total and 4000 text characters. Use the chat attachment picker for larger files.' : 'This share could not be accepted. Review any pending share below, then try sharing again.'}</Label>}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
    {loading ? <Label>Loading shared items…</Label> : !item ? <Card><Label>Nothing to share</Label><Label>Share photos, videos, files or text from another app and choose JM.</Label><Button variant="ghost" title="Go to chats" onPress={() => router.replace('/messenger')} /><Button variant="ghost" title="Discard pending share" onPress={() => { void discard().catch(cause => setError(errorMessage(cause))) }} /></Card> : <>
      <Card><Label>Sending as {me?.name || 'your signed-in account'}</Label>{item.files.length > 0 && <ScrollView horizontal contentContainerStyle={{ gap: 12 }} accessibilityLabel="Shared files">{item.files.map((file, index) => <SharedPreview key={`${item.id}:${file.name}:${index}`} file={file} />)}</ScrollView>}<Field label={item.files.length ? 'Caption (optional)' : 'Message'} multiline maxLength={4000} editable={!busy && !item.plan} value={caption} onChangeText={setCaption} /></Card>
      <Card><Label>Send to · Up to 5 chats</Label>{item.plan ? item.plan.jobs.map(job => <Label key={job.conversation}>{job.title} · {job.sent ? 'Sent' : 'Pending'}</Label>) : <><Field label="Search chats" value={search} onChangeText={setSearch} editable={!busy} /><Label>{chosen.length} selected</Label>{chosen.map(chat => <Button key={chat.id} variant="ghost" title={`Remove ${chat.title}`} disabled={busy} onPress={() => setChosen(value => value.filter(entry => entry.id !== chat.id))} />)}{targets.map(chat => { const selected = chosen.some(value => value.id === chat.id); return <Button key={chat.id} variant={selected ? 'primary' : 'secondary'} title={`${selected ? 'Selected: ' : ''}${chat.title}`} disabled={busy || (!selected && chosen.length >= 5)} onPress={() => setChosen(value => selected ? value.filter(entry => entry.id !== chat.id) : [...value, chat])} /> })}{!targets.length && <Label>No unlocked chats you can send this share to.</Label>}{cursor && <Button variant="ghost" title="Load more chats" onPress={() => { const generation = incomingShareGeneration(); void listConversations('all', search.trim(), cursor).then(page => { if (generation !== incomingShareGeneration()) return; setChats(value => [...new Map([...value, ...page.results].map(chat => [chat.id, chat])).values()]); setCursor(page.next_cursor) }).catch(cause => setError(errorMessage(cause))) }} />}</>}</Card>
      {!!progress && <Label>{progress}</Label>}
      <View style={styles.row}><Button variant="ghost" title={busy ? 'Cancel sending' : 'Discard'} onPress={() => { if (busy) shareController.cancel(); else void discard().catch(cause => setError(errorMessage(cause))) }} /><Button title={busy ? 'Sending…' : item.plan ? 'Retry remaining chats' : `Send (${chosen.length})`} disabled={busy || (!item.plan && (!chosen.length || (!item.files.length && !caption.trim())))} onPress={() => { void send() }} /></View>
      <Label>Nothing is sent until you choose Send. Cancel stops further work; completed messages cannot be recalled here.</Label>
    </>}
  </ScrollView></Workspace>
}
