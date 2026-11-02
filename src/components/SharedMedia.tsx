import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native'
import { getConversation, getShared, type SharedItem, type SharedKind } from '../modules/messenger/api'
import { mergeShared, safeSharedLink, sharedKey, sharedTabs } from '../modules/messenger/sharedMedia'
import { chatLock } from '../modules/messenger/chatLock'
import { errorMessage, origin } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { Button, useColors } from '../ui'
import { mediaUrl } from '../modules/messenger/media/url'
import { formatBytes, listTime } from '../modules/messenger/lib/text'
import { AttachmentExport } from './AttachmentExport'

/** Shared history comes from the server's visible window, never from guessed file URLs. */
export function SharedMedia({ conversation }: { conversation: string }) {
  const [kind, setKind] = useState<SharedKind>('media')
  const [items, setItems] = useState<SharedItem[]>([])
  const [before, setBefore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState<SharedItem | null>(null)
  const generation = useRef(0); const visible = useRef(true); const busy = useRef(false)
  const load = useCallback(async (cursor?: number) => {
    if (!visible.current || (cursor !== undefined && busy.current)) return
    const token = ++generation.current; busy.current = true; setLoading(true); setError('')
    if (cursor === undefined) { setItems([]); setExporting(null) }
    try {
      const detail = await getConversation(conversation)
      if (detail.locked && !chatLock.snapshot().unlocked) throw new Error('This chat is locked. Shared items are concealed.')
      if (token !== generation.current) return
      const page = await getShared(conversation, kind, cursor)
      if (token !== generation.current) return
      setItems(old => mergeShared(cursor === undefined ? [] : old, page.results)); setBefore(page.next_before)
    } catch (e) {
      if (token === generation.current) { setItems([]); setExporting(null); setBefore(null); setError(errorMessage(e)) }
    } finally { if (token === generation.current) { busy.current = false; setLoading(false) } }
  }, [conversation, kind])
  useEffect(() => {
    const invalidate = () => { generation.current++; busy.current = false }
    const lifecycle = subscribeSensitiveView(active => {
      visible.current = active
      if (active) void load()
      else { generation.current++; busy.current = false; setItems([]); setExporting(null); setLoading(false) }
    })
    const off = realtime.on('*', ({ type, data }) => {
      const event = data as { conversation?: string; id?: string } | null
      if (type === 'RESYNC' || ((event?.conversation === conversation || event?.id === conversation) && /^(MESSAGE_|CONVERSATION_|MEMBER_)/.test(type))) void load()
    })
    const offLock = chatLock.subscribe(() => { generation.current++; busy.current = false; setItems([]); setExporting(null); void load() })
    const timer = setInterval(() => void load(), 30000)
    return () => { invalidate(); clearInterval(timer); lifecycle(); off(); offLock() }
  }, [conversation, load])
  const c = useColors()
  const empty = kind === 'media' ? 'No photos or videos yet.' : kind === 'docs' ? 'No documents yet.' : 'No links yet.'
  const muted = { color: c.muted, fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' } as const
  return <View accessibilityLabel="Media, docs and links" style={{ gap: 12 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: c.neutral }}>{sharedTabs.map(tab => { const on = kind === tab.kind; return <Pressable key={tab.kind} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }} onPress={() => setKind(tab.kind)}
      style={{ flex: 1, minHeight: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.panel : 'transparent', ...(on ? { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null) }}>
      <Text style={{ color: on ? c.text : c.muted, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{tab.label}</Text></Pressable> })}</View>
    {loading && !items.length && <ActivityIndicator accessibilityLabel="Loading shared items" />}
    {!!error && <View style={{ alignItems: 'center', gap: 4, paddingVertical: 12 }}><Text style={{ color: c.danger, fontSize: 14 }}>{error}</Text><Button title="Try again" accessibilityLabel="Retry shared items" variant="ghost" onPress={() => void load()} /></View>}
    {!loading && !error && !items.length && <Text style={{ color: c.muted, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>{empty}</Text>}
    {kind === 'media' ? <View accessibilityLabel="Photos and videos" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{items.filter(item => item.attachment).map(item => { const a = item.attachment!; const thumb = mediaUrl(a.thumb_url, origin); return <Pressable key={sharedKey(item)} accessibilityRole="button" accessibilityLabel={`${a.kind === 'video' ? 'Video' : 'Photo'} · ${listTime(item.message.created_at)}`} onPress={() => setExporting(item)}
      style={({ pressed }) => ({ width: '32%', aspectRatio: 1, flexGrow: 0, borderRadius: 6, overflow: 'hidden', backgroundColor: c.neutral, opacity: pressed ? 0.8 : 1, alignItems: 'center', justifyContent: 'center' })}>
      {thumb && <Image source={{ uri: thumb }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />}
      {a.kind === 'video' && <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#ffffff', fontSize: 14, marginLeft: 2 }}>{'▶︎'}</Text></View>}
    </Pressable> })}</View>
    : items.map(item => <View key={sharedKey(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: c.border }}>
      {item.attachment ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.attachment.name}`} onPress={() => setExporting(item)} style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{item.attachment.name}</Text>
        <Text style={muted}>{formatBytes(item.attachment.size)} · {listTime(item.message.created_at)}</Text>
      </Pressable> : <View style={{ flex: 1, minWidth: 0 }}>
        {safeSharedLink(item.url) ? <Pressable accessibilityRole="link" accessibilityLabel={`Open link ${item.url}`} onPress={() => void Linking.openURL(safeSharedLink(item.url)!).catch(e => setError(errorMessage(e)))}><Text numberOfLines={1} style={{ color: c.primary, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{item.url}</Text></Pressable> : <Text numberOfLines={1} style={{ color: c.text, fontSize: 14 }}>{item.url}</Text>}
        {!!item.text && <Text numberOfLines={2} style={muted}>{item.text}</Text>}
        <Text style={muted}>{item.message.sender?.name}{item.message.sender ? ' · ' : ''}{listTime(item.message.created_at)}</Text>
      </View>}
    </View>)}
    {before !== null && <Button title={loading ? 'Loading…' : 'Show older'} accessibilityLabel="More shared items" variant="ghost" disabled={loading} onPress={() => void load(before)} />}
    {exporting?.attachment && <AttachmentExport conversation={conversation} message={exporting.message.id} seq={exporting.message.seq} attachment={exporting.attachment} onClose={() => setExporting(null)} />}
  </View>
}
