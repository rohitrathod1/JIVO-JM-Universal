import { isSelfChat } from '../modules/messenger/lib/selfChat'
import { MessageSkeleton } from './MessageSkeleton'
import { PendingMessages } from './PendingMessages'
import { router, useFocusEffect } from 'expo-router'
import { AttachmentPreview } from './AttachmentPreview'
import { capturePhoto } from '../modules/messenger/media/capture'
import { AtlasIcon } from './AtlasIcon'
import { useAtlasStatus } from '../modules/atlas/useAtlas'
import { ConnectionStatus } from './ConnectionStatus'
import { AttachmentExport } from './AttachmentExport'
import { RichMessage } from './RichMessage'
import { useChatImmersive } from './WorkspaceChrome'
import { ContactCard, PollCard, SpecialMessage } from './SpecialMessage'
import { ChatHeaderTitle, PeerCallButton } from './PeerCallButton'
import { isEmptySystemNotice } from '../modules/messenger/conversationInfo'
import { EventComposer } from './EventComposer'
import { LocationComposer } from './LocationPicker'
import { ChatComposer } from './ChatComposer'
import { DeletedText, HistoryStart, MessageAttachments, MessageBubble, MessageDay, MessageMetaSpacer, SystemNotice } from './MessagePresentation'
import { chatLock } from '../modules/messenger/chatLock'
import { LockedChatsGate } from '../modules/messenger/components/LockedChatsGate'
import { isAxiosError, isCancel } from 'axios'
import { conversationCache } from '../modules/messenger/conversationCache'
import { enqueueFiles, outbox, onOutboxSent } from '../modules/messenger/outbox'
import { useChatAppearance } from './ChatAppearance'
import { mediaUrl } from '../modules/messenger/media/url'
import { MessageDetails } from './MessageDetails'
import { firstLink, highlightParts, isMuted, listTime, sameDay, withMentionTokens } from '../modules/messenger/lib/text'
import { useConversationLive } from '../modules/messenger/useConversationLive'
import { arrivalBehavior } from '../modules/messenger/reader'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { randomUUID } from 'expo-crypto'
import * as chat from '../modules/messenger/api'
import { statusFor } from '../modules/messenger/lib/window'
import { HistoryController } from '../modules/messenger/history'
import { useCursor } from '../shared/useCursor'
import type { PickedFile } from '../modules/messenger/media/model'
import { pickDocument } from '../modules/messenger/media/picker'
import { useSession } from '../core/auth/Session'
import { errorMessage, origin } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { subscribeLifecycle } from '../core/realtime/lifecycle'
import { Button, Card, EmptyState, Field, Label, glass, useColors } from '../ui'
import { chatListWidth, isWide, touchBox } from '../shared/shellLayout'
import { actionFailure, OFFLINE_ACTION } from '../modules/messenger/offlineAction'
import { CreatePoll, ForwardMessage, FullImage, MessageActionSheet, SearchMessages, ShareContact } from './MessageTools'
import { MediaPlayback } from './MediaPlayback'
import { ConversationDetails } from './ConversationDetails'
import { ConversationPicker } from './ConversationPicker'
import { PersonDetails } from './PersonDetails'
import { PollVoters } from './PollVoters'
import { conversationDrafts } from '../modules/messenger/drafts'
import { caretAfterEdit, insertMention, mentionAt, type Caret } from '../modules/messenger/composer'
import { ComposerContext, ComposerPreview } from './ComposerPreview'
import { ChatAvatar } from './ChatAvatar'
import { Icon, IconButton, type IconName } from './Icon'
import { useLiveUpdates } from './LiveUpdates'
import { ChatListActions, ConfirmSheet, useListTyping } from './ChatListActions'
/** Reference ConversationList FILTERS; locked chats open from their own row, as in the reference. */
const listFilters: { value: chat.ConversationFilter; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }, { value: 'groups', label: 'Groups' }, { value: 'archived', label: 'Archived' }]
const listPointer = (Platform.OS === 'web' ? { cursor: 'pointer' } : {}) as object
const viewability = { itemVisiblePercentThreshold: 80, minimumViewTime: 400 }
/** RN Web passes `hovered` to Pressable style callbacks; native never does. */
const isHovered = (state: object) => Boolean((state as { hovered?: boolean }).hovered)
/** Reference row hover: hover:bg-black/[0.03] dark:hover:bg-white/[0.04]. */
const rowHover = (dark: boolean) => dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
/** Reference PreviewText icons for media last messages. */
const previewIcons: Record<chat.PreviewMedia, { icon: IconName; label: string }> = { photo: { icon: 'camera', label: 'Photo' }, video: { icon: 'video', label: 'Video' }, voice: { icon: 'mic', label: 'Voice message' }, file: { icon: 'fileText', label: 'File' }, contact: { icon: 'user', label: 'Contact' }, poll: { icon: 'barChart3', label: 'Poll' }, location: { icon: 'mapPin', label: 'Location' }, event: { icon: 'calendarDays', label: 'Event' } }

/** Reference chat root: bg-[#efeae2]/60 dark:bg-slate-950/40 over the app canvas; native has no canvas gradient, so it uses the solid mix. */
const chatTint = (c: ReturnType<typeof useColors>) => Platform.OS === 'web' ? (c.dark ? 'rgba(2,6,23,0.4)' : 'rgba(239,234,226,0.6)') : c.chat
function HeaderButton({ icon, label, onPress, disabled = false, round = false }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; round?: boolean }) {
  const c = useColors(); const { width } = useWindowDimensions(); const size = round ? 36 : 40
  // DEF-005: 44px phone hit box around the drawn 36/40px button.
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ ...touchBox(size, width), opacity: disabled ? 0.45 : 1, ...listPointer }}>
    {state => <View style={{ width: size, height: size, borderRadius: round ? 18 : 10, alignItems: 'center', justifyContent: 'center', backgroundColor: state.pressed || isHovered(state) ? c.hover : 'transparent' }}><Icon name={icon} size={20} color={round ? c.muted : c.text} /></View>}
  </Pressable>
}

/** Reference shared/ui/Menu: glass-4 dropdown, min-w-52, card radius, p-1, anchored under the header's ⋮ (sideOffset 6). */
function ChatMenu({ visible, onClose, children, bottom = false }: { visible: boolean; onClose: () => void; children: React.ReactNode; bottom?: boolean }) {
  const c = useColors(); const { width, height } = useWindowDimensions(); const inset = useSafeAreaInsets()
  if (!visible) return null
  return <Modal transparent visible onRequestClose={onClose} animationType="none">
    <Pressable accessibilityLabel="Close options" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(Platform.OS === 'web' ? ({ cursor: 'default' } as object) : {}) }} />
    <View accessibilityRole="menu" accessibilityLabel="Conversation options" style={[glass(c, 4), { position: 'absolute', ...(bottom ? { bottom: inset.bottom + 64, right: width < 768 ? 8 : 16 } : { top: inset.top + 58, right: width < 768 ? 8 : 16 }), minWidth: 208, maxHeight: height - inset.top - 74, borderWidth: 1, borderRadius: 12, padding: 4, overflow: 'hidden' }]}>
      <ScrollView>{children}</ScrollView>
    </View>
  </Modal>
}
function MenuItem({ icon, title, onPress, disabled = false, danger = false }: { icon: IconName; title: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={state => ({ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: state.pressed || isHovered(state) ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent', opacity: disabled ? 0.5 : 1, ...listPointer })}>
    <Icon name={icon} size={16} color={danger ? c.danger : c.text} /><Text style={{ color: danger ? c.danger : c.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{title}</Text>
  </Pressable>
}
function MenuSeparator() { const c = useColors(); return <View style={{ marginVertical: 4, height: 1, backgroundColor: c.border }} /> }

/** Reference MessageList unread separator: my-2 px-3 gap-3, brand/40 hairlines around a success-soft pill. */
function UnreadSeparator() {
  const c = useColors(); const line = c.dark ? 'rgba(34,197,94,0.4)' : 'rgba(22,163,74,0.4)'
  return <View accessibilityRole={Platform.OS === 'web' ? ('separator' as never) : undefined} accessibilityLabel="Unread messages" style={{ marginVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ flex: 1, height: 1, backgroundColor: line }} />
    <Text style={{ borderRadius: 999, overflow: 'hidden', backgroundColor: c.successSoft, paddingHorizontal: 12, paddingVertical: 2, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, lineHeight: 16, color: c.brand }}>Unread messages</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: line }} />
  </View>
}

/** Reference ConversationList Row: px-3 py-2.5, 48px avatar, 16px title, 12px time, 14px preview, 20px badges. */
function ConversationRow({ item, selected, disabled, typing, onPress, onMenu }: { item: chat.ConversationItem; selected: boolean; disabled: boolean; typing: boolean; onPress: () => void; onMenu: () => void }) {
  const { me } = useSession()
  const c = useColors(); const unread = item.unread_count > 0; const muted = !isSelfChat(item, me?.id) && isMuted(item.muted_until)
  const title = item.title || item.peer?.name || 'Conversation'
  const last = item.last_message
  const lastSender = item.kind === 'group' && last?.sender ? `${last.sender.name.split(' ')[0]}: ` : ''
  const media = last?.media ? previewIcons[last.media] : null
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} disabled={disabled} onPress={onPress} onLongPress={onMenu} delayLongPress={450} {...(Platform.OS === 'web' ? { onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); onMenu() }, onKeyDown: (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => { if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); onMenu() } } } as object : {})} style={state => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: selected ? c.successSoft : state.pressed || isHovered(state) ? rowHover(c.dark) : 'transparent', ...listPointer })}>
    <ChatAvatar name={item.kind === 'direct' ? item.peer?.name || title : title} seed={item.peer?.id ?? item.id} uri={mediaUrl(item.avatar_url, origin)} group={item.kind === 'group'} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontFamily: unread ? 'Inter_600SemiBold' : 'Inter_500Medium', fontWeight: unread ? '600' : '500', color: c.text, fontSize: 16, lineHeight: 24 }}>{title}</Text>
        <Text style={{ flexShrink: 0, fontFamily: unread ? 'Inter_500Medium' : 'Inter_400Regular', fontWeight: unread ? '500' : '400', color: unread ? c.brand : c.muted, fontSize: 12, lineHeight: 16 }}>{last ? listTime(last.created_at) : item.last_seq > 0 ? listTime(item.updated_at) : ''}</Text>
      </View>
      <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {typing ? <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.brand }}>typing…</Text> : <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
          {!item.left && media && !!lastSender && <Text style={{ flexShrink: 0, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: unread ? c.text : c.muted }}>{lastSender}</Text>}
          {!item.left && media && <View accessible accessibilityLabel={media.label} style={{ marginRight: 4 }}><Icon name={media.icon} size={15} color={unread ? c.text : c.muted} /></View>}
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: unread ? c.text : c.muted, fontStyle: last?.deleted ? 'italic' : 'normal' }}>{item.left ? 'You left this group' : last ? `${media ? '' : lastSender}${last.text ?? last.preview}` : item.last_seq > 0 ? 'Preview unavailable' : 'No messages yet'}</Text>
        </View>}
        {muted && <View accessible accessibilityLabel="Muted"><Icon name="bellOff" size={14} /></View>}
        {item.pinned_at && <View accessible accessibilityLabel="Pinned"><Icon name="pin" size={14} /></View>}
        {item.mention_unread && <View accessibilityLabel="You were mentioned" style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brandFill }}><Text style={{ color: '#ffffff', fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>@</Text></View>}
        {unread && <View accessibilityLabel={`${item.unread_count} unread`} style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: muted ? '#64748b' : c.brandFill }}><Text style={{ color: '#ffffff', fontSize: 11, lineHeight: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text></View>}
      </View>
    </View>
  </Pressable>
}

const emptyMessages: chat.Message[] = []

export function Messenger({ preview = false, initialConversation, initialSeq }: { preview?: boolean; initialConversation?: chat.ConversationItem; initialSeq?: number }) {
  const appearance = useChatAppearance().value; const backgroundImage = appearance?.type === 'image' ? mediaUrl(appearance.image_url, origin) : null
  const c = useColors(); const { width, height } = useWindowDimensions(); const compact = height < 600 || width < 768; const { me } = useSession()
  const [selection, setSelected] = useState<chat.ConversationItem | null>(initialConversation ?? null)
  // Reference MessageList "Unread messages" separator: remembered from the row that was opened, before reading clears it.
  const [unreadMark, setUnreadMark] = useState<{ id: string; seq: number } | null>(() => initialConversation && initialConversation.unread_count > 0 ? { id: initialConversation.id, seq: initialConversation.last_read_seq } : null)
  const summary = useLiveUpdates().summary as { unread_conversations?: number; unread_groups?: number; unread_archived?: number }
  const chipCounts: Partial<Record<chat.ConversationFilter, number>> = { unread: summary.unread_conversations, groups: summary.unread_groups, archived: summary.unread_archived }
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<chat.ConversationFilter>('all'); const [lockedCount, setLockedCount] = useState(0)
  const [body, setBody] = useState(() => initialConversation && me ? conversationDrafts.read(me.id, initialConversation.id) : ''); const [reply, setReply] = useState<chat.Message | null>(null); const [editing, setEditing] = useState<chat.Message | null>(null)
  const [person, setPerson] = useState<chat.PersonCard | null>(null); const [votes, setVotes] = useState<string | null>(null)
  const [caret, setCaret] = useState<Caret>({ start: body.length, end: body.length }); const [forcedCaret, setForcedCaret] = useState<Caret | undefined>()
  const mention = mentionAt(body, caret)
  const [pendingFile, setPendingFile] = useState<{ conversation: string; file: PickedFile } | null>(null)
  const pickingFile = useRef(false)
  const atlasEnabled = !!useAtlasStatus()?.enabled
  const [actions, setActions] = useState<chat.Message | null>(null)
  const [error, setError] = useState(''); const [sending, setSending] = useState(false)
  // OFF-05: a reaction or edit that failed for lack of a connection says so next to the composer (the banner alone is not tied to the action).
  const [actionNotice, setActionNotice] = useState('')
  const failAction = (e: unknown) => { const text = actionFailure(e, errorMessage); if (text === OFFLINE_ACTION) { setActions(null); setActionNotice(text) } else setError(text) }
  const [exporting,setExporting]=useState<{conversation:string;message:string;attachment:string}|null>(null)
  const [media, setMedia] = useState<{ conversation: string; message: string; attachment: string } | null>(null)
  const [menu, setMenuMode] = useState<'options' | 'tools' | null>(null); const setMenu = (open: boolean) => setMenuMode(open ? 'tools' : null); const [choice, setChoice] = useState<'clear' | null>(null)
  const [tool, setTool] = useState<'search' | 'poll' | 'contact' | 'details' | 'event' | 'location' | null>(null); const [forwarding, setForwarding] = useState<chat.Message | null>(null); const [image, setImage] = useState<{ conversation: string; message: string; attachment: string } | null>(null)
  const [revision, setRevision] = useState(0); const [picker, setPicker] = useState(false)
  const [attachments, setAttachments] = useState<chat.Attachment[]>([])
  const active = useRef(true); const draftId = useRef(randomUUID())
  const lockState = useSyncExternalStore(chatLock.subscribe, chatLock.snapshot, chatLock.snapshot)
  const [history] = useState(() => new HistoryController({ detail: chat.getConversation, read: chat.getWindow, message: errorMessage, cache: conversationCache, lockedAccess: () => chatLock.snapshot().unlocked }))
  useEffect(() => chatLock.subscribe(history.lockChanged), [history])
  useEffect(() => { const timer = setInterval(history.expire, 1000); return () => clearInterval(timer) }, [history])
  const historyState = useSyncExternalStore(history.subscribe, history.snapshot, history.snapshot)
  const concealed = historyState.locked || Boolean(selection?.locked && !lockState.unlocked)
  const selected = historyState.accessLost || concealed ? null : historyState.detail?.id === selection?.id ? historyState.detail : selection
  if (pendingFile && (!selected || pendingFile.conversation !== selected.id)) setPendingFile(null)
  const opened = Boolean(selection) && !historyState.accessLost
  useChatImmersive(opened && width < 768)
  const live = useConversationLive(preview ? null : selected, me?.id ?? '')
  const [info,setInfo] = useState<chat.Message | null>(null)
  const pending = useSyncExternalStore(outbox.subscribe,outbox.snapshot,outbox.snapshot)
  const historyMatchesSelection = historyState.id === selection?.id
  const messages = historyMatchesSelection ? historyState.window.messages : emptyMessages
  const firstUnreadSeq = unreadMark && unreadMark.id === selection?.id ? messages.find(m => m.seq > unreadMark.seq && m.kind !== 'system' && m.sender?.id !== me?.id)?.seq ?? null : null
  const currentAttachment = (source: typeof media) => source && source.conversation === selection?.id && !historyState.accessLost ? messages.find(m => m.id === source.message && !m.deleted)?.attachments?.find(a => a.id === source.attachment && a.status === 'ready') : undefined
  const exportAttachment=currentAttachment(exporting);
  const mediaAttachment = currentAttachment(media); const imageAttachment = currentAttachment(image)
  const gallery = messages.filter(message => !message.deleted).flatMap(message => message.attachments.filter(attachment => attachment.kind === 'image' && attachment.status === 'ready').map(attachment => ({ conversation: message.conversation, message: message.id, attachment: attachment.id })))
  const imageIndex = gallery.findIndex(item => item.attachment === image?.attachment)
  useEffect(() => history.subscribe(() => {
    const state = history.snapshot()
    const retain = (source: typeof media) => source && source.conversation === state.id && !state.accessLost && state.window.messages.some(m => m.id === source.message && !m.deleted && m.attachments?.some(a => a.id === source.attachment && a.status === 'ready')) ? source : null
    setMedia(retain); setImage(retain)
    if (state.accessLost || state.locked) { if (state.id && me) conversationDrafts.write(me.id, state.id, ''); setAttachments([]); setTool(null); setActions(null); setForwarding(null); setReply(null); setEditing(null); setBody(''); setPerson(null); setVotes(null); setInfo(null); setExporting(null); setMenu(false) }
  }), [history, me])
  const loadConversations = useCallback(async (cursor?: string | null) => {
    if (preview || filter === 'locked' && !lockState.unlocked) return { results: [], next_cursor: null }
    const cacheGeneration = conversationCache.generation()
    try {
      const page = await chat.listConversations(filter, query, cursor)
      if (!cursor && filter === 'all' && !query) { conversationCache.rememberList(page.results, cacheGeneration); setLockedCount(page.locked_count ?? 0) }
      return page
    } catch (e) {
      if (cursor || !isAxiosError(e) || e.response || isCancel(e)) throw e
      const saved = await conversationCache.list()
      if (!saved.length) throw e
      return { results: saved.filter(item =>
        (filter === 'archived' ? !!item.archived_at : !item.archived_at) &&
        (filter !== 'unread' || item.unread_count > 0) &&
        (filter !== 'groups' || item.kind === 'group') &&
        (filter !== 'direct' || item.kind === 'direct') && filter !== 'locked' &&
        (item.title || item.peer?.name || '').toLowerCase().includes(query.toLowerCase())), next_cursor: null }
    }
  }, [preview, filter, query, lockState.unlocked])
  const conversations = useCursor(loadConversations)
  const { items, cursor, loading, refresh: refreshConversations } = conversations
  const typingIn = useListTyping(me?.id ?? '')
  const [rowMenu, setRowMenu] = useState<chat.ConversationItem | null>(null)
  // Reference ConversationList "Messages" section: server message search under the chat rows from two characters.
  const term = query.trim(); const [hits, setHits] = useState<{ q: string; results: chat.SearchHit[]; incomplete: boolean }>({ q: '', results: [], incomplete: false })
  useEffect(() => {
    if (preview || term.length < 2) return
    let live = true
    const timer = setTimeout(() => { void chat.searchMessages(term).then(page => { if (live) setHits({ q: term, results: page.results, incomplete: Boolean(page.incomplete) }) }, () => { if (live) setHits({ q: term, results: [], incomplete: false }) }) }, 300)
    return () => { live = false; clearTimeout(timer) }
  }, [term, preview])
  const shownHits = term.length >= 2 && hits.q === term ? hits : null
  // Reference IntersectionObserver sentinel (rootMargin 400px): the next page loads as the list nears its end.
  const listBox = useRef({ height: 0, content: 0, offset: 0 })
  const visibleRows = useMemo(() => items.filter(item => !item.locked || lockState.unlocked), [items, lockState.unlocked])
  const nearEnd = useCallback(() => { const b = listBox.current; if (cursor && !loading && b.height && b.content - b.height - b.offset < 400) void conversations.more() }, [cursor, loading, conversations])
  useEffect(() => { nearEnd() }, [nearEnd, items.length])
  useEffect(()=>onOutboxSent(message=>{history.event({type:'MESSAGE_CREATED',data:message});void refreshConversations()}),[history,refreshConversations])
  const selectedId = selection?.id; const listRef = useRef<FlatList<chat.Message>>(null)
  const selectionGeneration = useRef(0); const jumpTo = useRef<{ id: string; seq: number } | null>(null)
  const [readPosition, setReadPosition] = useState({ conversation: '', seq: 0 })
  // RN-web FlatList throws ("Changing onViewableItemsChanged on the fly is not supported") if this handler's
  // identity ever changes for a mounted list, so keep one function for the component's lifetime.
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: { isViewable: boolean; item: chat.Message }[] }) => {
    const last = viewableItems.filter(v => v.isViewable).map(v => v.item).sort((a, b) => b.seq - a.seq)[0]
    if (last) setReadPosition({ conversation: last.conversation, seq: last.seq })
  })
  const [visible, setVisible] = useState(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => subscribeLifecycle(setVisible), [])
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  useFocusEffect(useCallback(() => {
    if (preview) return
    void history.refreshDetail()
    refresh()
  }, [history, preview, refresh]))
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
    const jump = jumpTo.current?.id === selectedId ? jumpTo.current?.seq : undefined; jumpTo.current = null
    void history.select(selectedId ?? null, selectedId === initialConversation?.id ? initialSeq : jump)
    realtime.setFocusedConversation(selectedId ?? null)
    return () => { history.invalidate(); realtime.setFocusedConversation(null) }
  }, [selectedId, preview, history, initialConversation?.id, initialSeq])
  // Web: keep the open chat in the address bar (reference /messenger/:id) so reload and copied links reopen it.
  // replaceState, not the router, because the route remounts Messenger when its `conversation` param changes.
  useEffect(() => {
    if (preview || Platform.OS !== 'web' || typeof window === 'undefined' || !window.location.pathname.startsWith('/messenger')) return
    const url = new URL(window.location.href)
    if ((url.searchParams.get('conversation') ?? undefined) === selectedId) return
    if (selectedId) url.searchParams.set('conversation', selectedId); else url.searchParams.delete('conversation')
    url.searchParams.delete('seq')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [selectedId, preview])
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
    if (sending) return
    selectionGeneration.current++
    if (history.snapshot().accessLost && selectedId === item.id) void history.select(item.id)
    setSelected(item); setUnreadMark(item.unread_count > 0 ? { id: item.id, seq: item.last_read_seq } : null); setBody(conversationDrafts.read(me?.id ?? '', item.id)); setForcedCaret(undefined); setReply(null); setEditing(null); setPerson(null); setVotes(null)
    setAttachments([]); setError(''); setPicker(false); draftId.current = randomUUID()
  }
  function changeBody(value: string) {
    setCaret(caretAfterEdit(body, value))
    setBody(value)
    if (selected && me && !editing) conversationDrafts.write(me.id, selected.id, value)
    draftId.current = randomUUID()
  }
  async function send() {
    if (!selected || !selected.can.send || sending || (!body.trim() && !attachments.length)) return
    setSending(true); setError('')
    try {
      live.stop()
      setActionNotice('')
      if (editing) history.accept(await chat.editMessage(editing.id, withMentionTokens(body.trim(), live.members)))
      else await outbox.enqueue(me?.id ?? '', selected.id, { client_id: draftId.current, body: withMentionTokens(body.trim(), live.members), upload_ids: attachments.map(a => a.id), reply_to: reply?.id }, { attachments })
      if (!editing && me) conversationDrafts.write(me.id, selected.id, '')
      if (!active.current) return
      setBody(editing ? conversationDrafts.read(me?.id ?? '', selected.id) : ''); setAttachments([]); setEditing(null); setReply(null); draftId.current = randomUUID(); followIncoming.current = true; nearBottom.current = true; listRef.current?.scrollToEnd({ animated: false }); if (historyState.window.hasMoreAfter) void history.latest(); refresh()
    } catch (e) { if (active.current) { if (editing) failAction(e); else setError(errorMessage(e)) } } finally { if (active.current) setSending(false) }
  }
  async function attach(type: string | string[] = '*/*', camera = false) {
    if (!selected?.can.send_file || pickingFile.current || editing) return
    pickingFile.current = true
    const generation = selectionGeneration.current
    try {
      const current = () => active.current && generation === selectionGeneration.current
      const file = camera ? await capturePhoto(current) : await pickDocument(type)
      if (!file) return
      if (!current()) { await file.dispose?.(); return }
      setPendingFile({ conversation: selected.id, file })
    } catch (e) { if (active.current) setError(errorMessage(e)) }
    finally { pickingFile.current = false }
  }
  async function perform(action: () => Promise<unknown>) {
    setSending(true); setError(''); setActionNotice('')
    try { await action(); if (active.current) { setActions(null); void history.reconcile(); void history.refreshDetail(); refresh() } }
    catch (e) { if (active.current) failAction(e) } finally { if (active.current) setSending(false) }
  }
  const applySettings = (data: Parameters<typeof chat.updateSettings>[1]) => perform(async () => { setSelected(await chat.updateSettings(selected!.id, data)) })
  function loadEarlier() { followIncoming.current = false; nearBottom.current = false; setReaderAway(true); void history.page('before') }
  // Reference MessengerPage: the chats column and the conversation pane sit side by side from `md` (768px).
  const split = isWide(width)
  const blocked = sending
  const rowState = useMemo(() => ({ selected: selected?.id, blocked, typingIn }), [selected?.id, blocked, typingIn])
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {!preview && <ConnectionStatus error={error || historyState.error || conversations.error} retrying={loading || historyState.loading} onRetry={() => { setError(''); if (historyState.accessLost) void history.select(selectedId ?? null); else void history.reconcile(); refresh() }} />}
    <View style={{ flex: 1, flexDirection: split ? 'row' : 'column' }}>
      {(split || !opened) && <View style={[{ width: split ? chatListWidth(width) : '100%', flex: split ? undefined : 1, borderRightWidth: split ? 1 : 0 }, glass(c, 1), { backgroundColor: c.shell }]}>
        {/* Reference ConversationList header: p-3, space-y-2.5, bottom border; phones show "Chats" in the top bar already. */}
        <View style={{ padding: 12, gap: 10, borderBottomWidth: 1, borderColor: c.border }}>
          {split && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text accessibilityRole="header" style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: c.text, fontSize: 18, lineHeight: 28 }}>Chats</Text>
            {!preview && <Pressable accessibilityRole="button" accessibilityLabel="Refresh chats" disabled={loading} onPress={refresh} style={state => ({ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: state.pressed || isHovered(state) ? c.hover : 'transparent', opacity: loading ? 0.6 : 1, ...listPointer })}>
              <Icon name="refreshCw" size={16} />
            </Pressable>}
          </View>}
          {filter === 'locked' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconButton name="back" label="Back to chats" onPress={() => setFilter('all')} />
            <Icon name="lock" size={16} color={c.brand} /><Text style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: c.text, fontSize: 15 }}>Locked chats</Text>
          </View> : <>
            <Field compact label="Search conversations" placeholder="Search chats" value={query} onChangeText={setQuery}
              trailing={query ? <IconButton name="x" label="Clear search" onPress={() => setQuery('')} /> : <View pointerEvents="none" style={{ width: 44, alignItems: 'center' }}><Icon name="search" size={20} /></View>} />
            {!preview && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginVertical: -8 }} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
              {/* Reference FILTERS chips: h-7, px-3, text-xs medium; the selected chip is the primary fill.
                  The pressable is a 44px-tall transparent hit area around the 28px pill (DEF-005); the row's -8 margins keep the layout. */}
              {listFilters.map(f => { const on = f.value === filter; const count = chipCounts[f.value] ?? 0; return <Pressable key={f.value} onPress={() => setFilter(f.value)} accessibilityLabel={f.label} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} style={state => ({ height: 44, minWidth: 44, justifyContent: 'center', ...listPointer, ...(isHovered(state) && !on ? { opacity: 0.9 } : {}) })}>{state => <View style={{ height: 28, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: on ? c.primary : c.neutral }}><Text style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 12, lineHeight: 16, color: on ? '#ffffff' : isHovered(state) ? c.text : c.muted }}>{f.label}</Text>
                {count > 0 && <View accessibilityLabel={`${count} unread`} style={{ marginLeft: 6, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.9)' : c.brandFill }}><Text style={{ fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 10, lineHeight: 12, color: on ? c.primary : '#ffffff' }}>{count > 99 ? '99+' : count}</Text></View>}</View>}</Pressable> })}
            </ScrollView>}
          </>}
        </View>
        {loading && !items.length && <ActivityIndicator style={{ marginTop: 8 }} />}
        {filter === 'locked' && !lockState.unlocked && <LockedChatsGate title="Locked chats" />}
        {/* Virtualised (PERF-04): only the rows near the viewport are mounted, so 500 chats stay fast. */}
        <FlatList style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 80 }} scrollEventThrottle={64} initialNumToRender={20} maxToRenderPerBatch={20} windowSize={9} removeClippedSubviews={Platform.OS === 'android'}
          onLayout={e => { listBox.current.height = e.nativeEvent.layout.height; nearEnd() }} onContentSizeChange={(_w, h) => { listBox.current.content = h; nearEnd() }} onScroll={e => { listBox.current.offset = e.nativeEvent.contentOffset.y; nearEnd() }}
          data={preview ? [] : visibleRows} keyExtractor={item => item.id} extraData={rowState}
          renderItem={({ item }) => <ConversationRow item={item} selected={selected?.id === item.id} disabled={blocked} typing={typingIn.has(item.id)} onPress={() => choose(item)} onMenu={() => setRowMenu(item)} />}
          ListHeaderComponent={<>
            {!preview && filter === 'all' && !query && lockedCount > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Locked chats, ${lockedCount}`} onPress={() => setFilter('locked')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.hover : 'transparent' })}>
              <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.successSoft }}><Icon name="lock" size={20} color={c.brand} /></View>
              <Text style={{ flex: 1, fontFamily: 'Inter_500Medium', fontWeight: '500', color: c.text, fontSize: 15 }}>Locked chats</Text><Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14 }}>{lockedCount}</Text>
            </Pressable>}
            {preview && ['Design team', 'Operations', 'Saved messages'].filter(t => t.toLowerCase().includes(query.toLowerCase())).map(title => <Card key={title}><Label>{title}</Label><Label>A place for your team’s conversations.</Label></Card>)}
          </>}
          ListFooterComponent={<>
            {!preview && !loading && !items.length && !shownHits?.results.length && !error && !conversations.error && <EmptyState title={query ? 'No chats match.' : filter === 'archived' ? 'No archived chats.' : filter === 'locked' ? 'No locked chats.' : lockedCount ? 'No other chats.' : 'No chats yet.'} description={!query && filter === 'all' ? 'Start a conversation with anyone at JIVO.' : undefined} action={!query && filter === 'all' ? <Button title="Start a chat" onPress={() => setPicker(true)} /> : undefined} />}
            {shownHits?.incomplete && <Text accessibilityRole={Platform.OS === 'web' ? ('status' as never) : undefined} style={{ paddingHorizontal: 12, paddingVertical: 8, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>Search incomplete: some messages are unavailable.</Text>}
            {!!shownHits?.results.length && <View accessibilityLabel="Messages found">
              <Text accessibilityRole="header" style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.neutral, paddingHorizontal: 12, paddingVertical: 6, color: c.muted, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, lineHeight: 16, letterSpacing: 0.3, textTransform: 'uppercase' }}>Messages</Text>
              {shownHits.results.map(h => <Pressable key={h.message.id} accessibilityRole="link" accessibilityLabel={`${h.conversation.title}: ${h.message.body}`} disabled={blocked} onPress={() => { const row = items.find(i => i.id === h.conversation.id); void (row ? Promise.resolve(row) : chat.getConversation(h.conversation.id)).then(found => { if (found.id === selectedId) void history.latest(h.message.seq); else { jumpTo.current = { id: found.id, seq: h.message.seq }; choose(found) } }, e => setError(errorMessage(e))) }} style={state => ({ borderBottomWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: state.pressed || isHovered(state) ? rowHover(c.dark) : 'transparent', ...listPointer })}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{h.conversation.title}</Text>
                  <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{listTime(h.message.created_at)}</Text>
                </View>
                <Text numberOfLines={2} style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{h.message.sender ? `${h.message.sender.name.split(' ')[0]}: ` : ''}{highlightParts(h.highlight ?? h.message.body).map((part, i) => part.hit ? <Text key={i} style={{ color: c.text, backgroundColor: c.dark ? 'rgba(240,180,41,0.3)' : 'rgba(232,163,23,0.3)', borderRadius: 4 }}>{part.text}</Text> : <Text key={i}>{part.text}</Text>)}</Text>
              </Pressable>)}
            </View>}
            <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>{!!cursor && loading && items.length > 0 && <ActivityIndicator accessibilityLabel="Loading more chats" color={c.brand} />}</View>
          </>} />
        {/* Reference ConversationList FAB: 56px, rounded-2xl, primary, bottom-8 right-4 (md:bottom-5); opens New chat. */}
        {!preview && atlasEnabled && <Pressable accessibilityRole="button" accessibilityLabel="Ask Atlas, JIVO business AI" onPress={() => router.push('/atlas')} style={{ position: 'absolute', right: 20, bottom: split ? 88 : 100, width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.dark ? 'rgba(129,140,248,0.3)' : 'rgba(99,102,241,0.18)', alignItems: 'center', justifyContent: 'center', backgroundColor: c.dark ? '#18232e' : '#ffffff', boxShadow: '0 3px 14px rgba(99,102,241,0.2)' }}><AtlasIcon /></Pressable>}
        {!preview && <Pressable accessibilityRole="button" accessibilityLabel="New chat" disabled={blocked} onPress={() => setPicker(true)} style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: split ? 20 : 32, width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, opacity: blocked ? 0.5 : 1, transform: [{ scale: pressed ? 0.96 : 1 }], boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', ...listPointer })}><Icon name="plus" size={28} color="#ffffff" /></Pressable>}
      </View>}
      {(split || opened) && <View style={{ flex: 1, padding: selected && !(concealed && opened) ? 0 : compact ? 8 : 12, gap: selected && !(concealed && opened) ? 0 : compact ? 6 : 10, backgroundColor: selected || opened ? chatTint(c) : 'transparent' }}>
        {concealed && opened ? <><IconButton name="back" label="Back to conversations" onPress={() => { setSelected(null); selectionGeneration.current++ }} /><LockedChatsGate /></> : selected ? <>
          {!split && !compact && <View style={{ padding: 12, paddingBottom: 0 }}><Button title="Back to conversations" disabled={blocked} onPress={() => { selectionGeneration.current++; setSelected(null); setAttachments([]) }} /></View>}
          {/* Reference ChatView Header: glass-1, h-16, gap-2, px-2 (md:px-4); 36px round back arrow on phones, 40px ghost icon buttons. */}
          <View style={[glass(c, 1), { flexDirection: 'row', gap: 8, alignItems: 'center', height: 64, paddingHorizontal: width < 768 ? 8 : 16, borderBottomWidth: 1 }]}>{compact && !split && <HeaderButton icon="back" label="Back to conversations" round disabled={blocked} onPress={() => { selectionGeneration.current++; setSelected(null); setAttachments([]) }} />}<View style={{ flex: 1, minWidth: 0, flexDirection: 'row', paddingHorizontal: 4 }}><ChatHeaderTitle conversation={selected} live={live.label} onPress={() => { if (selected.kind === 'group') router.push({ pathname: '/group-info', params: { conversation: selected.id } }); else setTool('details') }} /></View>
            <PeerCallButton conversation={selected} />
            <HeaderButton icon="moreVertical" label="Conversation options" onPress={() => setMenuMode('options')} />
          </View>
          <View style={{flex:1,backgroundColor:appearance?.type==='color' && /^#[0-9a-f]{6}$/i.test(appearance.color??'')?appearance.color!:'transparent'}}>{backgroundImage&&<Image pointerEvents="none" source={{uri:backgroundImage}} style={{position:'absolute',width:'100%',height:'100%',opacity:0.35}} resizeMode="cover"/>}<FlatList accessibilityLabel={readerAway ? 'Message history' : 'Latest messages'} key={selected.id} ref={listRef} data={messages} keyExtractor={m => m.client_id ?? m.id} ListFooterComponent={<PendingMessages conversation={selected.id} messages={messages} entries={pending.entries} />} contentContainerStyle={{ paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' }} keyboardShouldPersistTaps="handled" onViewableItemsChanged={onViewable} viewabilityConfig={viewability} maintainVisibleContentPosition={readerAway ? { minIndexForVisible: 0 } : undefined}
            scrollEventThrottle={16} onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; const atBottom = contentSize.height - layoutMeasurement.height - contentOffset.y < 96; const movedUp = contentOffset.y < scrollOffset.current - 1; const moved = Math.abs(contentOffset.y - scrollOffset.current) > 1; scrollOffset.current = contentOffset.y; if (movedUp) { followIncoming.current = false; nearBottom.current = atBottom } else if (atBottom || moved && !followIncoming.current) nearBottom.current = atBottom; setReaderAway(!nearBottom.current); if (nearBottom.current && !historyState.window.hasMoreAfter) setNewMessages(false) }}
            onContentSizeChange={(_width, height) => { contentHeight.current = height; scrollRequested(); if (followIncoming.current) { listRef.current?.scrollToOffset({ offset: contentHeight.current, animated: false }) } }}
            onScrollToIndexFailed={info => { if (jumpAttempts.current++ >= 3) return; listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false }); if (jumpTimer.current) clearTimeout(jumpTimer.current); jumpTimer.current = setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0, viewOffset: 8 }), 100) }}
            ListEmptyComponent={!pending.entries.some(p => p.conversation === selected.id) && (!historyMatchesSelection || historyState.loading) ? <MessageSkeleton /> : undefined}
            ListHeaderComponent={historyState.window.hasMoreBefore ? <Pressable accessibilityRole="button" accessibilityLabel="Load earlier messages" disabled={historyState.loading} onPress={loadEarlier} style={{ alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: c.dark ? c.brand : c.primary, fontSize: 13, fontFamily: 'Inter_500Medium' }}>Load earlier messages</Text></Pressable> : messages.length > 0 && !historyState.window.hasMoreBefore ? <HistoryStart visibleFrom={historyState.window.visibleFrom} /> : undefined}
            renderItem={({ item: m, index }) => { const prev = messages[index - 1]; const day = <><MessageDay createdAt={m.created_at} previousAt={prev?.created_at} />{firstUnreadSeq === m.seq && <UnreadSeparator />}</>
              if (isEmptySystemNotice(m)) return day
              if (m.kind === 'system') return <>{day}<SystemNotice>{m.body || m.system?.text || ''}</SystemNotice></>
              const own = m.sender?.id === me?.id; const runStart = !prev || prev.kind === 'system' || prev.sender?.id !== m.sender?.id || !sameDay(prev.created_at, m.created_at)
              const meta = { createdAt: m.created_at, edited: !!m.edited_at && !m.deleted, status: own && !m.deleted ? statusFor(m, me?.id ?? '', historyState.window.receipts) || m.status || 'sent' : null }
              // Bubbles that end with text keep the time inline on the last line, as the reference floats it right.
              const plain = !m.deleted && !!m.body && !m.poll && !m.location && !m.event && !m.contact && !firstLink(m.body)
              return <>{day}<MessageBubble own={own} sender={selected.kind === 'group' && !own && runStart ? m.sender?.name || 'JM' : null} label={`Message from ${m.sender?.name || 'JM'}`} meta={meta} inlineMeta={plain} selected={actions?.id === m.id} chevron={!m.deleted} actionsDisabled={blocked} onActions={() => setActions(m)}
                forwarded={!m.deleted && m.forwarded} reply={!m.deleted ? m.reply_to : null} onJump={seq => void history.latest(seq)} reactions={!m.deleted ? m.reactions : undefined} onReactions={() => setActions(m)}><View style={{ gap: 4 }}>
              {!m.deleted && m.attachments.length > 0 && <MessageAttachments items={m.attachments} own={own} origin={origin} onImage={a => setImage({ conversation: m.conversation, message: m.id, attachment: a.id })} onMedia={a => setMedia({ conversation: m.conversation, message: m.id, attachment: a.id })} onExport={a => setExporting({ conversation: m.conversation, message: m.id, attachment: a.id })} />}
              {m.deleted ? <DeletedText own={own} moderator={m.deleted_by_moderator} /> : !!m.body && <RichMessage own={own} body={m.body} mentions={live.members.filter(member=>m.mentions.includes(member.user.id)).map(member=>member.user.name)} trailing={plain ? <MessageMetaSpacer {...meta} /> : undefined} />}
              {!m.deleted && m.poll && <PollCard message={m} own={own} disabled={blocked} onVote={ids => void perform(() => chat.votePoll(m.id, ids))} onVoters={() => setVotes(m.id)} />}
              {!m.deleted && (m.location || m.event) && <SpecialMessage message={m} onChanged={() => void history.reconcile()} />}
              {!m.deleted && m.contact && <ContactCard person={m.contact} onProfile={() => setPerson(m.contact!)} />}
            </View></MessageBubble></> }} />
            {(readerAway || newMessages || historyState.window.hasMoreAfter) && <Pressable accessibilityRole="button" accessibilityLabel={newMessages ? 'New messages — jump to latest' : 'Jump to latest'} onPress={() => { setNewMessages(false); void history.latest() }}
              style={{ position: 'absolute', right: 6, bottom: 6, padding: 6, ...listPointer }}>
              {/* DEF-005: the transparent 6px ring makes the 32px pill a 44px hit box without changing how it looks. */}
              {({ pressed }) => <View style={[glass(c, 4), { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.8 : 1 }]}>
              {newMessages && <Text style={{ borderRadius: 999, paddingHorizontal: 6, backgroundColor: c.brandFill, color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16, overflow: 'hidden' }}>New</Text>}
              <Image accessible={false} source={require('../../assets/icons/ArrowDown.png')} style={{ width: 16, height: 16, tintColor: c.text }} />
              </View>}
            </Pressable>}</View>
          <View style={{ paddingHorizontal: 12, gap: 8 }}>
          {!compact && historyState.window.hasMoreAfter && <View style={{ paddingTop: 6 }}><Button title="Load newer messages" disabled={historyState.loading} onPress={() => void history.page('after')} /></View>}
          {!!pending.notice && <Label>{pending.notice}</Label>}

          {reply && <ComposerContext mode="reply" name={reply.sender?.name} text={reply.body || (reply.attachments.length ? '📎 Attachment' : '')} onCancel={() => setReply(null)} />}
          {!!actionNotice && <Text accessibilityRole="alert" style={{ color: c.text, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 }}>{actionNotice}</Text>}
          {editing && <ComposerContext mode="edit" text={editing.body} onCancel={() => { setEditing(null); setBody(conversationDrafts.read(me?.id ?? '', selected.id)) }} />}
          {attachments.map(a => <View key={a.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><View style={{ flex: 1 }}><Label>{a.name} • ready</Label></View><Button title="Remove file" disabled={blocked} onPress={() => void perform(async () => { await chat.discardUpload(a.id); setAttachments(v => v.filter(item => item.id !== a.id)); draftId.current = randomUUID() })} /></View>)}
          {selected.can.send && <ComposerPreview body={body} />}
          {selected.can.send && mention && <ScrollView horizontal style={{maxHeight:52}} contentContainerStyle={{gap:8}}>{live.members.filter(member => !member.is_me && member.user.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0,8).map(member => <Button key={member.user.id} title={'Mention '+member.user.name} disabled={blocked} onPress={() => { const next = insertMention(body, caret, member.user.name); changeBody(next.text); setCaret(next.caret); setForcedCaret(next.caret) }} />)}</ScrollView>}
          </View>
          {selected.can.send ? <ChatComposer key={selected.id} disabled={blocked} sendDisabled={!body.trim() && !attachments.length} sendLabel={sending ? 'Sending' : editing ? 'Save edit' : 'Send message'} onSend={() => void send()} attach={!editing ? { canSendFile: selected.can.send_file, onDocument: () => void attach(), onMedia: () => void attach(['image/*', 'video/*']), onCamera: () => void attach('image/*', true), onLocation: () => setTool('location'), onContact: () => setTool('contact'), onPoll: () => setTool('poll'), onEvent: () => setTool('event') } : undefined} onVoice={!editing && selected.can.send_file ? async file => { const clientId = randomUUID(); await enqueueFiles(me?.id ?? '', selected.id, { client_id: clientId, body: '', upload_ids: [] }, [{ key: randomUUID(), file }]); followIncoming.current = true; nearBottom.current = true; listRef.current?.scrollToEnd({ animated: false }); refresh() } : undefined} inputProps={{ value: body, onBlur: live.stop, selection: forcedCaret, onSelectionChange: event => setCaret(event.nativeEvent.selection), onChangeText: value => { setForcedCaret(undefined); changeBody(value); if (value.trim()) live.typing(); else live.stop() } }} /> : <Text style={{ color: selected.send_block === 'peer_inactive' ? (c.dark ? '#fbbf24' : '#b45309') : c.muted, backgroundColor: selected.send_block === 'peer_inactive' ? (c.dark ? '#3b3020' : '#fef3c7') : 'transparent', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: c.border, textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14 }}>{selected.send_block === 'peer_inactive' ? 'This person is no longer active. You can still read your history, but cannot send new messages.' : 'Sending is unavailable in this conversation.'}</Text>}
        </> : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 }}><View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: c.successSoft }}><Icon name="messagesSquare" size={32} color={c.brand} /></View><Text accessibilityRole="header" style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: c.text, fontSize: 18, lineHeight: 28, textAlign: 'center' }}>JIVO Messenger</Text><Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 384 }}>Choose a chat, or start one with anyone across JIVO.</Text></View>}
      </View>}
    </View>
    {selected && <ChatMenu visible={menu === 'options'} onClose={() => setMenu(false)}>
      {/* Reference ChatView Header ⋮ menu, in its order. */}
      <MenuItem icon="search" title="Search" onPress={() => { setMenu(false); setTool('search') }} />
      <MenuItem icon={selected.pinned_at ? 'pinOff' : 'pin'} title={selected.pinned_at ? 'Unpin' : 'Pin'} disabled={blocked} onPress={() => { setMenu(false); void applySettings({ pinned: !selected.pinned_at }) }} />
      {lockState.unlocked && <MenuItem icon="eyeOff" title="Hide locked chats" onPress={() => { setMenu(false); chatLock.relock() }} />}
      <MenuSeparator />
      <MenuItem icon="eraser" title="Clear chat for me" danger disabled={blocked} onPress={() => { setMenu(false); setChoice('clear') }} />
    </ChatMenu>}

    {selected && <ConfirmSheet visible={choice === 'clear'} onClose={() => setChoice(null)} title="Clear this chat for you?" body="Messages so far are hidden for you only. Others still see them." confirmLabel="Clear chat" onConfirm={() => { setChoice(null); void perform(() => chat.clearChat(selected.id)).then(() => void history.latest()) }} />}
    <ChatListActions chat={rowMenu} onClose={() => setRowMenu(null)} onChanged={refresh} onError={setError} onDeleted={id => { if (selectedId === id) { selectionGeneration.current++; setSelected(null) } }} />
    {selected && pendingFile?.conversation === selected.id && <AttachmentPreview key={selected.id} initialFile={pendingFile.file} initialCaption={body} conversation={selected.id} onClose={() => setPendingFile(null)} onSend={async (files, caption, clientId) => {
      await enqueueFiles(me?.id ?? '', selected.id, { client_id: clientId, body: withMentionTokens(caption.trim(), live.members), upload_ids: attachments.map(a => a.id), reply_to: reply?.id }, files, attachments)
      if (me) conversationDrafts.write(me.id, selected.id, '')
      setBody(''); setAttachments([]); setReply(null); setPendingFile(null); draftId.current = randomUUID()
      followIncoming.current = true; nearBottom.current = true; listRef.current?.scrollToEnd({ animated: false }); if (historyState.window.hasMoreAfter) void history.latest(); refresh()
    }} />}

    {selected && selectedId && tool === 'details' && <ConversationDetails conversation={selectedId} initialDetail={historyState.detail ? { ...historyState.detail, ...selected } : undefined} onUpdated={next => setSelected(next)} onClear={() => void history.latest()} onChanged={() => { void history.refreshDetail(); void history.reconcile(); refresh() }} onLeave={() => { setTool(null); setSelected(null); refresh() }} onClose={() => setTool(null)} />}
    {selected && selectedId && tool === 'search' && <SearchMessages conversation={selectedId} onJump={seq => void history.latest(seq)} onClose={() => setTool(null)} />}
    {selected && selectedId && tool === 'poll' && <CreatePoll conversation={selectedId} onSent={message => { history.accept(message); setTool(null); void history.latest(); refresh() }} onClose={() => setTool(null)} />}
    {selected && selectedId && tool === 'contact' && <ShareContact conversation={selectedId} onSent={message => { history.accept(message); setTool(null); void history.latest(); refresh() }} onClose={() => setTool(null)} />}
    {selected && tool === 'event' && <EventComposer conversation={selected.id} onSent={message => { history.accept(message); setTool(null); void history.latest(); refresh() }} onClose={() => setTool(null)} />}
    {selected && tool === 'location' && <LocationComposer conversation={selected.id} onSent={message => { history.accept(message); setTool(null); void history.latest(); refresh() }} onClose={() => setTool(null)} />}
    {info && selected && info.conversation===selected.id && <MessageDetails message={info} onClose={()=>setInfo(null)} />}
    {votes && selected && messages.some(message => message.id === votes && !message.deleted) && <PollVoters id={votes} onClose={() => setVotes(null)} onPerson={value => { setVotes(null); setPerson(value) }} />}
    {person && selected && <PersonDetails person={person} onClose={() => setPerson(null)} />}
    {forwarding && <ForwardMessage message={forwarding} onClose={() => { setForwarding(null); refresh() }} />}
    {exporting&&exportAttachment&&<AttachmentExport key={exporting.message+exporting.attachment} conversation={exporting.conversation} message={exporting.message} seq={messages.find(m=>m.id===exporting.message)?.seq??0} attachment={exportAttachment} onClose={()=>setExporting(null)}/>}
    {mediaAttachment && <MediaPlayback attachment={mediaAttachment} onClose={() => setMedia(null)} />}
    {imageAttachment && <FullImage attachment={imageAttachment} onClose={() => setImage(null)} previous={imageIndex > 0 ? () => setImage(gallery[imageIndex - 1]) : undefined} next={imageIndex >= 0 && imageIndex < gallery.length - 1 ? () => setImage(gallery[imageIndex + 1]) : undefined} />}
    {picker && <ConversationPicker groupAllowed={Boolean(me?.capabilities.includes('JM_CREATE_GROUP') && me?.can_create_groups !== false)} onChoose={choose} onClose={() => setPicker(false)} />}
    <MessageActionSheet key={actions?.id ?? 'none'} message={actions} own={!!actions && actions.sender?.id === me?.id} busy={sending} canReply={!!selected?.can.send} editDisabled={attachments.length > 0} onClose={() => setActions(null)}
      onReact={emoji => { if (actions) void perform(() => chat.setReaction(actions.id, emoji)) }} onUnreact={() => { if (actions) void perform(() => chat.clearReaction(actions.id)) }}
      onReply={() => { if (!actions) return; if (editing && selected) setBody(conversationDrafts.read(me?.id ?? '', selected.id)); setEditing(null); setReply(actions); setActions(null); draftId.current = randomUUID() }}
      onForward={() => { setForwarding(actions); setActions(null) }}
      onEdit={() => { if (!actions) return; setEditing(actions); setReply(null); setBody(actions.body); setActions(null) }}
      onInfo={() => { setInfo(actions); setActions(null) }}
      onExport={a => { if (!actions) return; setExporting({ conversation: actions.conversation, message: actions.id, attachment: a.id }); setActions(null) }}
      onDelete={scope => { if (actions) void perform(() => chat.deleteMessage(actions.id, scope).then(() => { history.event({ type: scope === 'me' ? 'MESSAGE_HIDDEN' : 'MESSAGE_DELETED', data: { conversation: actions.conversation, id: actions.id, seq: actions.seq, by_moderator: false, updated_at: new Date().toISOString() } }) })) }} />
  </KeyboardAvoidingView>
}

