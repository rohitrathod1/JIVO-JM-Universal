import { AttachmentExport } from './AttachmentExport'
import { CapturePanel } from './CapturePanel'
import { RichMessage } from './RichMessage'
import { outbox, onOutboxSent } from '../modules/messenger/outbox'
import { outboxStorageNotice } from '../modules/messenger/outboxStorage'
import { useChatAppearance } from './ChatAppearance'
import { mediaUrl } from '../modules/messenger/media/url'
import { MessageDetails } from './MessageDetails'
import { withMentionTokens } from '../modules/messenger/lib/text'
import { useConversationLive } from '../modules/messenger/useConversationLive'
import { arrivalBehavior } from '../modules/messenger/reader'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { randomUUID } from 'expo-crypto'
import * as chat from '../modules/messenger/api'
import { statusFor } from '../modules/messenger/lib/window'
import { HistoryController } from '../modules/messenger/history'
import { useCursor } from '../shared/useCursor'
import { Sheet } from './Sheet'
import type { PickedFile } from '../modules/messenger/media/model'
import { pickDocument } from '../modules/messenger/media/picker'
import { uploadAttachment } from '../modules/messenger/media/upload'
import { useSession } from '../core/auth/Session'
import { errorMessage, origin } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { subscribeLifecycle } from '../core/realtime/lifecycle'
import { Button, Card, Field, Label, useColors } from '../ui'
import { CreatePoll, ForwardMessage, FullImage, SearchMessages, ShareContact } from './MessageTools'
import { MediaPlayback } from './MediaPlayback'
import { ConversationDetails } from './ConversationDetails'
import { ConversationPicker } from './ConversationPicker'
import { PersonDetails } from './PersonDetails'
import { PollVoters } from './PollVoters'
import { conversationDrafts } from '../modules/messenger/drafts'
import { caretAfterEdit, insertMention, mentionAt, type Caret } from '../modules/messenger/composer'
import { ComposerPreview } from './ComposerPreview'
const viewability = { itemVisiblePercentThreshold: 80, minimumViewTime: 400 }

export function Messenger({ preview = false, initialConversation, initialSeq }: { preview?: boolean; initialConversation?: chat.ConversationItem; initialSeq?: number }) {
  const appearance = useChatAppearance().value; const backgroundImage = appearance?.type === 'image' ? mediaUrl(appearance.image_url, origin) : null
  const c = useColors(); const { width, height } = useWindowDimensions(); const nativePhone = Platform.OS !== 'web' && width < 600; const compact = height < 600 || nativePhone; const { me } = useSession()
  const [selection, setSelected] = useState<chat.ConversationItem | null>(initialConversation ?? null)
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<chat.ConversationFilter>('all')
  const [body, setBody] = useState(() => initialConversation && me ? conversationDrafts.read(me.id, initialConversation.id) : ''); const [reply, setReply] = useState<chat.Message | null>(null); const [editing, setEditing] = useState<chat.Message | null>(null)
  const [person, setPerson] = useState<chat.PersonCard | null>(null); const [votes, setVotes] = useState<string | null>(null)
  const [caret, setCaret] = useState<Caret>({ start: body.length, end: body.length }); const [forcedCaret, setForcedCaret] = useState<Caret | undefined>()
  const mention = mentionAt(body, caret)
  const [actions, setActions] = useState<chat.Message | null>(null); const [confirmDelete, setConfirmDelete] = useState<'me' | 'everyone' | null>(null)
  const [error, setError] = useState(''); const [sending, setSending] = useState(false)
  const [exporting,setExporting]=useState<{conversation:string;message:string;attachment:string}|null>(null)
  const [media, setMedia] = useState<{ conversation: string; message: string; attachment: string } | null>(null)
  const [menu, setMenu] = useState(false); const [capture,setCapture]=useState(false)
  const [tool, setTool] = useState<'search' | 'poll' | 'contact' | 'details' | null>(null); const [forwarding, setForwarding] = useState<chat.Message | null>(null); const [image, setImage] = useState<{ conversation: string; message: string; attachment: string } | null>(null)
  const [revision, setRevision] = useState(0); const [picker, setPicker] = useState(false)
  const [attachments, setAttachments] = useState<chat.Attachment[]>([]); const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const upload = useRef<AbortController | null>(null); const active = useRef(true); const draftId = useRef(randomUUID())
  const [history] = useState(() => new HistoryController({ detail: chat.getConversation, read: chat.getWindow, message: errorMessage }))
  const historyState = useSyncExternalStore(history.subscribe, history.snapshot, history.snapshot)
  const selected = historyState.accessLost ? null : historyState.detail?.id === selection?.id ? historyState.detail : selection
  const live = useConversationLive(preview ? null : selected, me?.id ?? '')
  const [info,setInfo] = useState<chat.Message | null>(null)
  const pending = useSyncExternalStore(outbox.subscribe,outbox.snapshot,outbox.snapshot)
  const messages = historyState.window.messages
  const currentAttachment = (source: typeof media) => source && source.conversation === selection?.id && !historyState.accessLost ? messages.find(m => m.id === source.message && !m.deleted)?.attachments?.find(a => a.id === source.attachment && a.status === 'ready') : undefined
  const exportAttachment=currentAttachment(exporting);
  const mediaAttachment = currentAttachment(media); const imageAttachment = currentAttachment(image)
  const gallery = messages.filter(message => !message.deleted).flatMap(message => message.attachments.filter(attachment => attachment.kind === 'image' && attachment.status === 'ready').map(attachment => ({ conversation: message.conversation, message: message.id, attachment: attachment.id })))
  const imageIndex = gallery.findIndex(item => item.attachment === image?.attachment)
  useEffect(() => history.subscribe(() => {
    const state = history.snapshot()
    const retain = (source: typeof media) => source && source.conversation === state.id && !state.accessLost && state.window.messages.some(m => m.id === source.message && !m.deleted && m.attachments?.some(a => a.id === source.attachment && a.status === 'ready')) ? source : null
    setMedia(retain); setImage(retain)
    if (state.accessLost) { if (state.id && me) conversationDrafts.write(me.id, state.id, ''); upload.current?.abort(); setAttachments([]); setTool(null); setActions(null); setForwarding(null); setReply(null); setEditing(null); setBody(''); setPerson(null); setVotes(null) }
  }), [history, me])
  const loadConversations = useCallback((cursor?: string | null) => preview ? Promise.resolve({ results: [], next_cursor: null }) : chat.listConversations(filter, query, cursor), [preview, filter, query])
  const conversations = useCursor(loadConversations)
  const { items, cursor, loading, refresh: refreshConversations } = conversations
  useEffect(()=>onOutboxSent(message=>{history.event({type:'MESSAGE_CREATED',data:message});void refreshConversations()}),[history,refreshConversations])
  const selectedId = selection?.id; const listRef = useRef<FlatList<chat.Message>>(null)
  const selectionGeneration = useRef(0)
  const [readPosition, setReadPosition] = useState({ conversation: '', seq: 0 })
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { isViewable: boolean; item: chat.Message }[] }) => {
    const last = viewableItems.filter(v => v.isViewable).map(v => v.item).sort((a, b) => b.seq - a.seq)[0]
    if (last) setReadPosition({ conversation: last.conversation, seq: last.seq })
  }, [])
  const [visible, setVisible] = useState(true)
  useEffect(() => { active.current = true; return () => { active.current = false; upload.current?.abort() } }, [])
  useEffect(() => subscribeLifecycle(setVisible), [])
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  useEffect(() => { if (revision) void refreshConversations() }, [revision, refreshConversations])
  useEffect(() => {
    if (preview) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const off = realtime.on('*', frame => {
      history.event(frame)
      if (!/^(MESSAGE_|CONVERSATION_|MEMBER_|RESYNC)/.test(frame.type)) return
      clearTimeout(timer); timer = setTimeout(refresh, 150)
    })
    return () => { off(); clearTimeout(timer) }
  }, [preview, refresh, history])
  useEffect(() => {
    if (preview) return
    void history.select(selectedId ?? null, selectedId === initialConversation?.id ? initialSeq : undefined)
    realtime.setFocusedConversation(selectedId ?? null)
    return () => { history.invalidate(); realtime.setFocusedConversation(null) }
  }, [selectedId, preview, history, initialConversation?.id, initialSeq])
  const contentHeight = useRef(0); const [readerAway, setReaderAway] = useState(false); const scrollOffset = useRef(0); const nearBottom = useRef(true); const followIncoming = useRef(false); const [newMessages, setNewMessages] = useState(false)
  const lastArrival = useRef({ id: selectedId, seq: 0, jump: 0 })
  useEffect(() => {
    const seq = Math.max(historyState.window.lastSeq, messages.at(-1)?.seq ?? 0)
    const previous = lastArrival.current
    if (previous.id !== selectedId || previous.jump !== historyState.latestJump) { nearBottom.current = historyState.targetSeq === null; followIncoming.current = historyState.targetSeq === null; setReaderAway(historyState.targetSeq !== null); setNewMessages(false) }
    else { const behavior = arrivalBehavior(nearBottom.current, historyState.window.hasMoreAfter, previous.seq, seq); if (behavior === 'follow') { followIncoming.current = true; listRef.current?.scrollToOffset({ offset: contentHeight.current, animated: false }) } else if (behavior === 'indicate') setNewMessages(true) }
    lastArrival.current = { id: selectedId, seq, jump: historyState.latestJump }
  }, [selectedId, historyState.latestJump, historyState.targetSeq, historyState.window.lastSeq, historyState.window.hasMoreAfter, messages])
  const completedJump = useRef(0)
  const jumpAttempts = useRef(0); const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (jumpTimer.current) clearTimeout(jumpTimer.current) }, [])
  const scrollRequested = useCallback(() => {
    if (completedJump.current === historyState.latestJump || !listRef.current) return
    const index = historyState.targetSeq === null ? -1 : messages.findIndex(m => m.seq === historyState.targetSeq)
    jumpAttempts.current = 0
    if (index >= 0) listRef.current.scrollToIndex({ index, animated: false, viewPosition: 0, viewOffset: 8 })
    else listRef.current.scrollToOffset({ offset: contentHeight.current, animated: false })
    completedJump.current = historyState.latestJump
  }, [historyState.latestJump, historyState.targetSeq, messages])
  useEffect(() => { const timer = setTimeout(scrollRequested, 0); return () => clearTimeout(timer) }, [scrollRequested])
  useEffect(() => {
    if (!selectedId || readPosition.conversation !== selectedId || !readPosition.seq || preview || !visible) return
    void chat.markDelivered(selectedId, readPosition.seq).catch(() => {})
    void chat.markRead(selectedId, readPosition.seq).catch(() => {})
  }, [selectedId, readPosition, preview, visible])
  function choose(item: chat.ConversationItem) {
    if (sending || uploadProgress !== null) return
    selectionGeneration.current++
    if (history.snapshot().accessLost && selectedId === item.id) void history.select(item.id)
    setSelected(item); setBody(conversationDrafts.read(me?.id ?? '', item.id)); setForcedCaret(undefined); setReply(null); setEditing(null); setPerson(null); setVotes(null)
    setAttachments([]); setError(''); setPicker(false); draftId.current = randomUUID()
  }
  function changeBody(value: string) {
    setCaret(caretAfterEdit(body, value))
    setBody(value)
    if (selected && me && !editing) conversationDrafts.write(me.id, selected.id, value)
    draftId.current = randomUUID()
  }
  async function send() {
    if (!selected || !selected.can.send || sending || uploadProgress !== null || (!body.trim() && !attachments.length)) return
    setSending(true); setError('')
    try {
      live.stop()
      if (editing) history.accept(await chat.editMessage(editing.id, withMentionTokens(body.trim(), live.members)))
      else outbox.enqueue(me?.id ?? '', selected.id, { client_id: draftId.current, body: withMentionTokens(body.trim(), live.members), upload_ids: attachments.map(a => a.id), reply_to: reply?.id })
      if (!editing && me) conversationDrafts.write(me.id, selected.id, '')
      if (!active.current) return
      setBody(editing ? conversationDrafts.read(me?.id ?? '', selected.id) : ''); setAttachments([]); setEditing(null); setReply(null); draftId.current = randomUUID(); await history.latest(); refresh()
    } catch (e) { if (active.current) setError(errorMessage(e)) } finally { if (active.current) setSending(false) }
  }
  async function attach() {
    if (!selected?.can.send_file || upload.current || editing) return
    let file: PickedFile | null = null
    setError('')
    try {
      const generation = selectionGeneration.current
      file = await pickDocument(); if (!file || !active.current || generation !== selectionGeneration.current) return
      const abort = new AbortController(); upload.current = abort; setUploadProgress(0)
      const attachment = await uploadAttachment(file, randomUUID(), abort.signal, p => { if (active.current) setUploadProgress(p) })
      if (active.current) { setAttachments(a => [...a, attachment]); draftId.current = randomUUID() }
    } catch (e) { if (active.current) setError(errorMessage(e)) }
    finally { try { await file?.dispose?.() } catch { if(active.current)setError('A temporary attachment could not be removed.') }; upload.current = null; if (active.current) setUploadProgress(null) }
  }
  async function perform(action: () => Promise<unknown>) {
    setSending(true); setError('')
    try { await action(); if (active.current) { setActions(null); setConfirmDelete(null); void history.reconcile(); void history.refreshDetail(); refresh() } }
    catch (e) { if (active.current) setError(errorMessage(e)) } finally { if (active.current) setSending(false) }
  }
  function loadEarlier() { followIncoming.current = false; nearBottom.current = false; setReaderAway(true); void history.page('before') }
  const split = width >= 1100
  const blocked = sending || uploadProgress !== null
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {!!(error || historyState.error || conversations.error) && <View style={{ padding: 12, gap: 8 }}><Text accessibilityRole="alert" style={{ color: c.text }}>{error || historyState.error || conversations.error}</Text><Button title="Retry" onPress={() => { setError(''); if (historyState.accessLost) void history.select(selectedId ?? null); else void history.reconcile(); refresh() }} /></View>}
    <View style={{ flex: 1, flexDirection: split ? 'row' : 'column' }}>
      {(split || !selected) && <View style={{ width: split ? 340 : '100%', flex: split ? undefined : 1, padding: compact ? 8 : 18, gap: compact ? 6 : 12, borderRightWidth: split ? 1 : 0, borderColor: c.border }}>
        {!compact && <Label large>Messages</Label>}<View style={{ flexDirection: compact ? 'row' : 'column', gap: 8 }}><View style={{ flex: compact ? 1 : undefined }}><Field compact={compact} label="Search conversations" value={query} onChangeText={setQuery} /></View>{compact && !preview && <Button title="New conversation" onPress={() => setPicker(true)} disabled={blocked} />}</View>
        {!preview && <>{!compact && <Button title="New conversation" onPress={() => setPicker(true)} disabled={blocked} />}
          <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0, minHeight: 48 }} contentContainerStyle={{ gap: 8 }}>
            {(['all', 'unread', 'groups', 'direct', 'archived'] as const).map(f => <Pressable key={f} onPress={() => setFilter(f)} accessibilityRole="button" accessibilityState={{ selected: f === filter }} style={{ padding: 10, borderRadius: 12, backgroundColor: f === filter ? c.primary : c.panel }}><Text style={{ color: f === filter ? 'white' : c.text }}>{f}</Text></Pressable>)}
          </ScrollView></>}
        {loading && <ActivityIndicator />}
        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ gap: 10 }}>
          {preview ? ['Design team', 'Operations', 'Saved messages'].filter(t => t.toLowerCase().includes(query.toLowerCase())).map(title => <Card key={title}><Label>{title}</Label><Label>A place for your team’s conversations.</Label></Card>) :
            items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.title || item.peer?.name}`} disabled={blocked} onPress={() => choose(item)}><Card>
              <Label>{item.title || item.peer?.name || 'Conversation'}</Label><Text numberOfLines={2} style={{ color: c.muted }}>{item.last_message?.preview || 'No messages yet'}</Text>{item.unread_count > 0 && <Label>{item.unread_count} unread</Label>}
            </Card></Pressable>)}
          {!preview && !loading && !items.length && !error && <Label>No conversations found.</Label>}
          {cursor && <Button title="Load more conversations" disabled={loading} onPress={() => void conversations.more()} />}
        </ScrollView>
      </View>}
      {(split || selected) && <View style={{ flex: 1, padding: compact ? 8 : width < 500 ? 12 : 20, gap: compact ? 6 : 12 }}>
        {selected ? <>
          {!split && !compact && <Button title="Back to conversations" disabled={blocked} onPress={() => { selectionGeneration.current++; setSelected(null); setAttachments([]) }} />}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}><View style={{ flex: 1, minWidth: 0 }}>{nativePhone ? <><Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28 }}>{selected.title || selected.peer?.name}</Text>{!!live.label && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{live.label}</Text>}</> : <><Label large>{selected.title || selected.peer?.name}</Label>{!!live.label && <Label>{live.label}</Label>}</>}</View>
            {!compact && <Button title={selected.pinned_at ? 'Unpin' : 'Pin'} disabled={blocked} onPress={() => void perform(() => chat.updateSettings(selected.id, { pinned: !selected.pinned_at }))} />}
            {!compact && <Button title={selected.archived_at ? 'Unarchive' : 'Archive'} disabled={blocked} onPress={() => void perform(() => chat.updateSettings(selected.id, { archived: !selected.archived_at }))} />}
            {compact && <Button title={nativePhone ? 'Options' : 'Conversation options'} accessibilityLabel="Conversation options" onPress={() => setMenu(true)} />}
          </View>
          {!compact && <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0, minHeight: 48 }} contentContainerStyle={{ gap: 8 }}><Button title="Conversation details" disabled={blocked} onPress={() => setTool('details')} /><Button title="Search messages" disabled={blocked} onPress={() => setTool('search')} />{selected.can.send && <><Button title="Create poll" disabled={blocked} onPress={() => setTool('poll')} /><Button title="Share contact" disabled={blocked} onPress={() => setTool('contact')} /></>}</ScrollView>}
          {!compact && historyState.window.hasMoreBefore && <Button title="Load earlier messages" disabled={historyState.loading} onPress={() => loadEarlier()} />}
          <View style={{flex:1,backgroundColor:appearance?.type==='color' && /^#[0-9a-f]{6}$/i.test(appearance.color??'')?appearance.color!:undefined}}>{backgroundImage&&<Image pointerEvents="none" source={{uri:backgroundImage}} style={{position:'absolute',width:'100%',height:'100%',opacity:0.35}} resizeMode="cover"/>}<FlatList accessibilityLabel={readerAway ? 'Message history' : 'Latest messages'} key={selected.id} ref={listRef} data={messages} keyExtractor={m => m.id} contentContainerStyle={{ gap: 10, paddingVertical: 8 }} keyboardShouldPersistTaps="handled" onViewableItemsChanged={onViewable} viewabilityConfig={viewability} maintainVisibleContentPosition={readerAway ? { minIndexForVisible: 0 } : undefined}
            scrollEventThrottle={16} onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; const atBottom = contentSize.height - layoutMeasurement.height - contentOffset.y < 96; const movedUp = contentOffset.y < scrollOffset.current - 1; const moved = Math.abs(contentOffset.y - scrollOffset.current) > 1; scrollOffset.current = contentOffset.y; if (movedUp) { followIncoming.current = false; nearBottom.current = atBottom } else if (atBottom || moved && !followIncoming.current) nearBottom.current = atBottom; setReaderAway(!nearBottom.current); if (nearBottom.current && !historyState.window.hasMoreAfter) setNewMessages(false) }}
            onContentSizeChange={(_width, height) => { contentHeight.current = height; scrollRequested(); if (followIncoming.current) { listRef.current?.scrollToOffset({ offset: contentHeight.current, animated: false }) } }}
            onScrollToIndexFailed={info => { if (jumpAttempts.current++ >= 3) return; listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false }); if (jumpTimer.current) clearTimeout(jumpTimer.current); jumpTimer.current = setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0, viewOffset: 8 }), 100) }}
            ListEmptyComponent={<Label>No messages yet.</Label>}
            renderItem={({ item: m }) => <Pressable onLongPress={() => { setActions(m); setConfirmDelete(null) }} accessibilityLabel={`Message from ${m.sender?.name || 'JM'}`}><Card>
              <Text style={{ color: c.primary, fontWeight: '700' }}>{m.sender?.name || 'JM'}</Text>
              {m.reply_to && <Text style={{ color: c.muted }}>{m.reply_to.sender_name}: {m.reply_to.preview}</Text>}
              {m.deleted ? <Label>Message deleted</Label> : <RichMessage body={m.body || (m.kind === 'system' ? m.system?.text ?? '' : '')} mentions={live.members.filter(member=>m.mentions.includes(member.user.id)).map(member=>member.user.name)} />}
              {!m.deleted && m.attachments.map(a => <View key={a.id} style={{ gap: 4 }}>
                {a.kind === 'image' && a.status === 'ready' && a.thumb_url?.startsWith('/') && !a.thumb_url.startsWith('//') && <Image accessibilityLabel={a.name} source={{ uri: `${origin}${a.thumb_url}` }} style={{ width: '100%', maxWidth: 280, height: 180, borderRadius: 12 }} resizeMode="contain" />}
                <Label>{a.name} • {a.status}</Label>
                {a.status==='ready'&&<Button title={'Export attachment '+a.name} onPress={()=>setExporting({conversation:m.conversation,message:m.id,attachment:a.id})}/>}
                {a.status === 'ready' && (a.kind === 'audio' || a.kind === 'video') && <Button title={`Open media ${a.name}`} onPress={() => setMedia({ conversation: m.conversation, message: m.id, attachment: a.id })} />}
                {a.status === 'ready' && a.kind === 'image' && <Button title={`View image ${a.name}`} onPress={() => setImage({ conversation: m.conversation, message: m.id, attachment: a.id })} />}
              </View>)}
              {!m.deleted && m.poll && <><Label>{m.poll.question}</Label>{m.poll.options.map(option => <Button key={option.id} title={`${option.text} (${option.votes})${option.me ? ' • selected' : ''}`} disabled={blocked || !m.can.vote} onPress={() => void perform(() => chat.votePoll(m.id, m.poll!.allow_multiple ? m.poll!.options.filter(o => o.me !== (o.id === option.id)).map(o => o.id) : [option.id]))} />)}</>}
              {!m.deleted && m.poll && <Button title={`View votes (${m.poll.voters})`} onPress={() => setVotes(m.id)} />}
              {!m.deleted && m.contact && <Button title={`Contact: ${m.contact.name}`} onPress={() => setPerson(m.contact!)} />}
              {m.reactions.length > 0 && <Label>{m.reactions.map(r => `${r.emoji} ${r.count}`).join('   ')}</Label>}
              <Text style={{ color: c.muted, fontSize: 12 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.edited_at ? ' • edited' : ''}{m.sender?.id === me?.id ? ` • ${statusFor(m, me?.id ?? '', historyState.window.receipts) || m.status || 'sent'}` : ''}</Text>
              {!m.deleted && <Button title="Message actions" disabled={blocked} onPress={() => { setActions(m); setConfirmDelete(null) }} />}
            </Card></Pressable>} /></View>
          {newMessages && <Button title="New messages — jump to latest" onPress={() => { setNewMessages(false); void history.latest() }} />}
          {!compact && historyState.window.hasMoreAfter && <Button title="Load newer messages" disabled={historyState.loading} onPress={() => void history.page('after')} />}
          {!compact && <Button title="Jump to latest" disabled={historyState.loading} onPress={() => void history.latest()} />}
          {pending.entries.some(p=>p.conversation===selected.id)&&<ScrollView style={{maxHeight:150}} contentContainerStyle={{gap:8}}><Label>{outboxStorageNotice}</Label>{pending.entries.filter(p=>p.conversation===selected.id).map(p=><Card key={p.payload.client_id}><Label>{p.payload.body || 'Attachment message'} — {p.status}</Label>{!!p.error&&<Label>{p.error}</Label>}<Button title="Retry queued message" disabled={p.status==='sending'} onPress={()=>{outbox.retry(p.payload.client_id);void outbox.flush()}}/><Button title="Discard queued message" disabled={p.status==='sending'} onPress={()=>outbox.discard(p.payload.client_id)}/></Card>)}</ScrollView>}{!!pending.notice&&<Label>{pending.notice}</Label>}
          {reply && <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Label>Replying to {reply.sender?.name}: {reply.body.slice(0, 80)}</Label></View><Button title="Cancel reply" onPress={() => setReply(null)} /></View>}
          {editing && <><Label>Editing message</Label><Button title="Cancel edit" onPress={() => { setEditing(null); setBody(conversationDrafts.read(me?.id ?? '', selected.id)) }} /></>}
          {attachments.map(a => <View key={a.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><View style={{ flex: 1 }}><Label>{a.name} • ready</Label></View><Button title="Remove file" disabled={blocked} onPress={() => void perform(async () => { await chat.discardUpload(a.id); setAttachments(v => v.filter(item => item.id !== a.id)); draftId.current = randomUUID() })} /></View>)}
          {uploadProgress !== null && <><Label>{uploadProgress < 1 ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Waiting for server file checks…'}</Label><Button title="Cancel upload" onPress={() => upload.current?.abort()} /></>}
          {selected.can.send && <ComposerPreview body={body} />}
          {selected.can.send && mention && <ScrollView horizontal style={{maxHeight:52}} contentContainerStyle={{gap:8}}>{live.members.filter(member => !member.is_me && member.user.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0,8).map(member => <Button key={member.user.id} title={'Mention '+member.user.name} disabled={blocked} onPress={() => { const next = insertMention(body, caret, member.user.name); changeBody(next.text); setCaret(next.caret); setForcedCaret(next.caret) }} />)}</ScrollView>}
          {selected.can.send ? <View style={{ flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : undefined, gap: 8 }}><View style={{ flex: compact ? 1 : undefined }}><Field compact={compact} label="Message" value={body} onBlur={live.stop} selection={forcedCaret} onSelectionChange={event => { setCaret(event.nativeEvent.selection) }} onChangeText={v => { setForcedCaret(undefined); changeBody(v); live.typing() }} multiline editable={!blocked} style={{ maxHeight: compact ? 64 : 120 }} /></View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{!compact && selected.can.send_file && !editing && <><Button title="Capture or import" disabled={blocked} onPress={()=>setCapture(true)}/><Button title="Attach file" disabled={blocked} onPress={() => void attach()} /></>}<View style={{ flex: compact ? undefined : 1, minWidth: compact ? undefined : 140 }}><Button title={sending ? 'Sending…' : editing ? 'Save edit' : 'Send message'} disabled={blocked || (!body.trim() && !attachments.length)} onPress={() => void send()} /></View></View>
          </View> : <Label>Sending is unavailable in this conversation.</Label>}
        </> : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}><Text style={{ color: c.primary, fontSize: 54 }}>JM</Text><Label large>Your conversations, together</Label><Label>Select a conversation to get started.</Label></View>}
      </View>}
    </View>
    {compact && selected && <Sheet visible={menu} onClose={() => setMenu(false)}><Label large>Conversation options</Label>
      <Button title="Back to conversations" disabled={blocked} onPress={() => { setMenu(false); setSelected(null); selectionGeneration.current++ }} />
      <Button title="Conversation details" onPress={() => { setMenu(false); setTool('details') }} /><Button title="Search messages" onPress={() => { setMenu(false); setTool('search') }} />
      {selected.can.send && <><Button title="Create poll" onPress={() => { setMenu(false); setTool('poll') }} /><Button title="Share contact" onPress={() => { setMenu(false); setTool('contact') }} /></>}
      {selected.can.send_file && <Button title="Capture or import" disabled={blocked} onPress={()=>{setMenu(false);setCapture(true)}}/>}
      {selected.can.send_file && <Button title="Attach file" disabled={blocked} onPress={() => { setMenu(false); void attach() }} />}
      {historyState.window.hasMoreBefore && <Button title="Load earlier messages" disabled={historyState.loading} onPress={() => { setMenu(false); loadEarlier() }} />}
      {historyState.window.hasMoreAfter && <Button title="Load newer messages" disabled={historyState.loading} onPress={() => { setMenu(false); void history.page('after') }} />}
      <Button title="Jump to latest" disabled={historyState.loading} onPress={() => { setMenu(false); void history.latest() }} />
      <Button title={selected.pinned_at ? 'Unpin' : 'Pin'} disabled={blocked} onPress={() => { setMenu(false); void perform(() => chat.updateSettings(selected.id, { pinned: !selected.pinned_at })) }} />
      <Button title={selected.archived_at ? 'Unarchive' : 'Archive'} disabled={blocked} onPress={() => { setMenu(false); void perform(() => chat.updateSettings(selected.id, { archived: !selected.archived_at })) }} />
      <Button title="Close options" onPress={() => setMenu(false)} />
    </Sheet>}
    {selected && capture && <CapturePanel key={selected.id} conversation={selected.id} onClose={()=>setCapture(false)} onReady={file=>{setAttachments(old=>[...old,file]);draftId.current=randomUUID();setCapture(false)}}/>}
    {selectedId && tool === 'details' && <ConversationDetails conversation={selectedId} onClear={() => void history.latest()} onChanged={() => { void history.refreshDetail(); void history.reconcile(); refresh() }} onLeave={() => { setTool(null); setSelected(null); refresh() }} onClose={() => setTool(null)} />}
    {selectedId && tool === 'search' && <SearchMessages conversation={selectedId} onJump={seq => void history.latest(seq)} onClose={() => setTool(null)} />}
    {selectedId && tool === 'poll' && <CreatePoll conversation={selectedId} onSent={message => { history.accept(message); setTool(null); void history.latest(); refresh() }} onClose={() => setTool(null)} />}
    {selectedId && tool === 'contact' && <ShareContact conversation={selectedId} onSent={message => { history.accept(message); setTool(null); void history.latest(); refresh() }} onClose={() => setTool(null)} />}
    {info && selected && info.conversation===selected.id && <MessageDetails message={info} onClose={()=>setInfo(null)} />}
    {votes && selected && messages.some(message => message.id === votes && !message.deleted) && <PollVoters id={votes} onClose={() => setVotes(null)} onPerson={value => { setVotes(null); setPerson(value) }} />}
    {person && selected && <PersonDetails person={person} onClose={() => setPerson(null)} />}
    {forwarding && <ForwardMessage message={forwarding} onClose={() => { setForwarding(null); refresh() }} />}
    {exporting&&exportAttachment&&<AttachmentExport key={exporting.message+exporting.attachment} conversation={exporting.conversation} message={exporting.message} seq={messages.find(m=>m.id===exporting.message)?.seq??0} attachment={exportAttachment} onClose={()=>setExporting(null)}/>}
    {mediaAttachment && <MediaPlayback attachment={mediaAttachment} onClose={() => setMedia(null)} />}
    {imageAttachment && <FullImage attachment={imageAttachment} onClose={() => setImage(null)} previous={imageIndex > 0 ? () => setImage(gallery[imageIndex - 1]) : undefined} next={imageIndex >= 0 && imageIndex < gallery.length - 1 ? () => setImage(gallery[imageIndex + 1]) : undefined} />}
    {picker && <ConversationPicker groupAllowed={Boolean(me?.can_create_groups)} onChoose={choose} onClose={() => setPicker(false)} />}
    <Sheet visible={Boolean(actions)} onClose={() => { if (!sending) setActions(null) }}>
      <Label large>Message actions</Label>{actions && <Button title="Message information" onPress={()=>{setInfo(actions);setActions(null)}}/>}
      {actions?.can.reply && selected?.can.send && <Button title="Reply" onPress={() => { if (editing && selected) setBody(conversationDrafts.read(me?.id ?? '', selected.id)); setEditing(null); setReply(actions); setActions(null); draftId.current = randomUUID() }} />}
      {actions?.can.forward && <Button title="Forward message" onPress={() => { setForwarding(actions); setActions(null) }} />}
      {actions?.can.edit && <Button title="Edit message" disabled={attachments.length > 0} onPress={() => { setEditing(actions); setReply(null); setBody(actions.body); setActions(null) }} />}
      {actions?.can.react && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{['👍', '❤️', '🎉'].map(emoji => <Button key={emoji} title={emoji} disabled={sending} onPress={() => void perform(() => chat.setReaction(actions.id, emoji))} />)}<Button title="Clear reaction" disabled={sending} onPress={() => void perform(() => chat.clearReaction(actions.id))} /></View>}
      {confirmDelete ? <><Label>Delete this message {confirmDelete === 'me' ? 'for you' : 'for everyone'}?</Label><Button title="Confirm delete" disabled={sending} onPress={() => { if (actions) void perform(() => chat.deleteMessage(actions.id, confirmDelete).then(() => { history.event({ type: confirmDelete === 'me' ? 'MESSAGE_HIDDEN' : 'MESSAGE_DELETED', data: { conversation: actions.conversation, id: actions.id, seq: actions.seq, by_moderator: false, updated_at: new Date().toISOString() } }) })) }} /></> : <>
        <Button title="Delete for me" disabled={sending} onPress={() => setConfirmDelete('me')} />
        {actions?.can.delete_for_everyone && <Button title="Delete for everyone" disabled={sending} onPress={() => setConfirmDelete('everyone')} />}
      </>}
      <Button title="Close actions" disabled={sending} onPress={() => setActions(null)} />
    </Sheet>
  </KeyboardAvoidingView>
}

