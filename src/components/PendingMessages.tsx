import { useEffect, useState } from 'react'
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native'
import type { Message } from '../modules/messenger/api'
import { pendingForConversation, type PendingSend } from '../modules/messenger/outboxController'
import { queuedMedia, type QueuedMedia } from '../modules/messenger/queuedMedia'
import { outbox } from '../modules/messenger/outbox'
import { useColors } from '../ui'
import { Icon } from './Icon'
import { MessageTicks } from './MessagePresentation'
import { clockTime } from '../modules/messenger/lib/text'
import { mediaUrl } from '../modules/messenger/media/url'
import { chatImageLayout } from '../modules/messenger/lib/imageLayout'
import { origin } from '../core/api/client'

const WAIT_NOTICE_MS = 1500

function SavedImage({ entry, media, box }: { entry: PendingSend; media: QueuedMedia; box: { width: number; height: number } }) {
 const [uri, setUri] = useState<string | null>(null)
 useEffect(() => {
  let active = true; let dispose: (() => void | Promise<void>) | undefined
  void queuedMedia.open(entry.owner, entry.payload.client_id, media).then(file => { dispose = file.dispose; if (active) setUri(file.uri); else void dispose?.() }).catch(() => {})
  return () => { active = false; void dispose?.() }
 }, [entry.owner, entry.payload.client_id, media.key, media])
 return uri ? <Image source={{ uri }} accessibilityLabel={media.name} style={{ ...box, borderRadius: 10 }} resizeMode="cover" /> : <View style={{ ...box, alignItems: 'center', justifyContent: 'center' }}><Icon name="image" /></View>
}
export function PendingMessages({ conversation, messages, entries }: { conversation: string; messages: Message[]; entries: PendingSend[] }) {
 const c = useColors()
 const { width } = useWindowDimensions()
 const visible = pendingForConversation(entries, conversation, messages)
 // A queued entry that has not left within a moment (offline, paused or retrying) gets the reference status line.
 const [now, setNow] = useState(() => Date.now())
 const hasYoung = visible.some(p => p.status === 'queued' && !(p.attempts ?? 0) && now - p.created < WAIT_NOTICE_MS)
 // Re-check a few times a second only while a fresh queued entry might still cross the notice threshold.
 useEffect(() => {
  if (!hasYoung) return
  const timer = setTimeout(() => setNow(Date.now()), 250)
  return () => clearTimeout(timer)
 }, [hasYoung, now])
 const waiting = (p: PendingSend) => p.status === 'queued' && ((p.attempts ?? 0) > 0 || now - p.created >= WAIT_NOTICE_MS)
 return <View style={{ gap: 4, paddingHorizontal: 12 }}>{visible.map(p => <View key={p.payload.client_id} style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: c.outgoing, borderRadius: 16, borderBottomRightRadius: 4, padding: 8, gap: 4 }}>
  {!!p.media?.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{p.media.map(m => m.mime.startsWith('image/') ? <SavedImage key={m.key} entry={p} media={m} box={chatImageLayout(width, p.media!.filter(item => item.mime.startsWith('image/')).length).box} /> : <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}><Icon name="fileText" /><Text numberOfLines={2} style={{ color: c.text, flexShrink: 1 }}>{m.name}</Text></View>)}</View>}
  {p.attachments?.map(a => <View key={a.id} style={{ gap: 4 }}>{a.thumb_url ? <Image source={{ uri: mediaUrl(a.thumb_url, origin) ?? undefined }} style={{ ...chatImageLayout(width, p.attachments!.filter(item => item.kind === 'image').length).box, borderRadius: 10 }} /> : <Text style={{ color: c.text }}>{a.name}</Text>}</View>)}
  {!!p.payload.body && <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>{p.payload.body}</Text>}
  {!p.payload.body && !p.media?.length && !p.attachments?.length && <View style={{ padding: 8 }}><Icon name="paperclip" /></View>}
  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
   {p.status === 'sending' && !!p.media?.length && <Text style={{ color: c.muted, fontSize: 11 }}>{p.progress === 1 ? 'Processing' : `${Math.round((p.progress ?? 0) * 100)}%`}</Text>}
   <Text style={{ color: c.muted, fontSize: 11 }}>{clockTime(new Date(p.created).toISOString())}</Text><MessageTicks status={p.status} />
   {p.status === 'failed' && <><Pressable accessibilityRole="button" accessibilityLabel="Retry queued message" onPress={() => outbox.retry(p.payload.client_id)} style={{ padding: 8 }}><Icon name="refreshCw" size={16} color={c.brand} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Discard queued message" onPress={() => outbox.discard(p.payload.client_id)} style={{ padding: 8 }}><Icon name="trash2" size={16} color={c.danger} /></Pressable></>}
  </View>
  {waiting(p) && <View accessibilityRole={'status' as never} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}><Icon name="cloudOff" size={13} color={c.muted} /><Text style={{ color: c.muted, fontSize: 12 }}>Waiting for network · sends automatically</Text><Pressable accessibilityRole="button" accessibilityLabel="Discard queued message" onPress={() => outbox.discard(p.payload.client_id)} hitSlop={8} style={{ paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: c.danger, fontSize: 12, fontWeight: '600' }}>Discard</Text></Pressable></View>}
  {p.status === 'failed' && !!p.error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 12 }}>{p.error}</Text>}
 </View>)}</View>
}
