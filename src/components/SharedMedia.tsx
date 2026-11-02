import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, View } from 'react-native'
import { getConversation, getShared, type SharedItem, type SharedKind } from '../modules/messenger/api'
import { mergeShared, safeSharedLink, sharedKey, sharedTabs } from '../modules/messenger/sharedMedia'
import { chatLock } from '../modules/messenger/chatLock'
import { errorMessage } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { Button, Card, Label } from '../ui'
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
  return <Card><Label large>Media, links and docs</Label>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{sharedTabs.map(tab => <Button key={tab.kind} title={`${tab.label}${kind === tab.kind ? ' selected' : ''}`} onPress={() => setKind(tab.kind)} />)}</View>
    {loading && <ActivityIndicator accessibilityLabel="Loading shared items" />}
    {!!error && <><Label>{error}</Label><Button title="Retry shared items" onPress={() => void load()} /></>}
    {!loading && !error && !items.length && <Label>No shared {kind} yet.</Label>}
    {items.map(item => <View key={sharedKey(item)} style={{ gap: 6, paddingVertical: 8 }}>
      <Label>{item.attachment?.name ?? item.text ?? item.url}</Label>
      <Label>{item.message.sender?.name} · {new Date(item.message.created_at).toLocaleDateString()}</Label>
      {item.attachment && <Button title={`Open ${item.attachment.name}`} onPress={() => setExporting(item)} />}
      {!!safeSharedLink(item.url) && <Button title={`Open link ${item.url}`} onPress={() => void Linking.openURL(safeSharedLink(item.url)!).catch(e => setError(errorMessage(e)))} />}
    </View>)}
    {before !== null && <Button title="More shared items" disabled={loading} onPress={() => void load(before)} />}
    {exporting?.attachment && <AttachmentExport conversation={conversation} message={exporting.message.id} seq={exporting.message.seq} attachment={exporting.attachment} onClose={() => setExporting(null)} />}
  </Card>
}
