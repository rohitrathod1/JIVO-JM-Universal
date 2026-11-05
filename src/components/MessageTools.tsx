import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { setStringAsync } from 'expo-clipboard'
import { firstEmoji, MORE_REACTIONS, QUICK_REACTIONS } from '../modules/messenger/lib/text'
import { Icon, type IconName } from './Icon'
import { randomUUID } from 'expo-crypto'
import * as chat from '../modules/messenger/api'
import { errorMessage, origin } from '../core/api/client'
import { useCursor } from '../shared/useCursor'
import { Button, Card, Field, Label, glass, useColors } from '../ui'
import { Sheet } from './Sheet'
import { ImageViewer } from './ImageViewer'
import { mediaUrl } from '../modules/messenger/media/url'
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
export function FullImage({ attachment, onClose, previous, next }: { attachment: chat.Attachment; onClose: () => void; previous?: () => void; next?: () => void }) {
  const inset = useSafeAreaInsets()
  const uri = mediaUrl(attachment.preview_url || attachment.download_url, origin)
  return <Modal visible onRequestClose={onClose} animationType="fade" presentationStyle="fullScreen">
    <View style={{ flex: 1, backgroundColor: '#080d10', paddingTop: inset.top, paddingBottom: inset.bottom }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close image" onPress={onClose} style={{ padding: 12 }}><Icon name="back" color="#ffffff" /></Pressable>
        <Text numberOfLines={1} style={{ flex: 1, color: '#ffffff', fontSize: 16 }}>{attachment.name}</Text>
      </View>
      {uri ? <ImageViewer key={attachment.id} uri={uri} name={attachment.name} previous={previous} next={next} /> : <Label>This image URL is unsupported.</Label>}
    </View>
  </Modal>
}

const web = Platform.OS === 'web'
const pointer = web ? ({ cursor: 'pointer' } as object) : null
type Hover = { hovered?: boolean; pressed: boolean }

/**
 * Reference MessageActionSheet: bottom sheet on phones, centred 384px card from 768px. Reaction bar (6 quick emoji + "+"
 * picker), a quoted preview, then Reply, Copy, Forward, Edit, Info and Delete rows. Accessibility labels keep the
 * existing test hooks ("Message information", "Edit message", "Forward message", "Close actions", ...).
 */
export function MessageActionSheet({ message: m, own = true, busy = false, canReply = true, editDisabled = false, onClose, onReact, onUnreact, onReply, onForward, onEdit, onInfo, onExport, onDelete }: {
  message: chat.Message | null
  busy?: boolean
  canReply?: boolean
  editDisabled?: boolean
  onClose: () => void
  onReact: (emoji: string) => void
  onUnreact: () => void
  onReply: () => void
  onForward: () => void
  onEdit: () => void
  /** Reference shows Info only on your own messages. */
  own?: boolean
  onInfo: () => void
  onExport: (attachment: chat.Attachment) => void
  onDelete: (scope: 'me' | 'everyone') => void
}) {
  const c = useColors(); const { width, height } = useWindowDimensions(); const inset = useSafeAreaInsets()
  const [more, setMore] = useState(false)
  const [picking, setPicking] = useState(false); const [typed, setTyped] = useState(''); const [confirm, setConfirm] = useState<'me' | 'everyone' | null>(null)
  if (!m) return null
  const desktop = width >= 768
  const close = () => { if (busy) return; setPicking(false); setConfirm(null); onClose() }
  const mine = m.reactions.find(r => r.me)?.emoji
  const react = (e: string) => { setPicking(false); if (e === mine) onUnreact(); else onReact(e) }
  const exportable = m.deleted ? [] : m.attachments.filter(a => (a.kind === 'image' || a.kind === 'audio' || a.kind === 'video') && a.status === 'ready')
  const row = (icon: IconName, title: string, label: string, onPress: () => void, opts: { danger?: boolean; disabled?: boolean } = {}) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!opts.disabled || busy }} disabled={opts.disabled || busy} onPress={onPress}
    style={({ hovered, pressed }: Hover) => [{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 12, opacity: opts.disabled ? 0.5 : 1, backgroundColor: pressed ? (c.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)') : hovered ? (c.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent' }, opts.disabled ? null : pointer]}>
    <Icon name={icon} size={20} color={opts.danger ? c.danger : c.muted} /><Text style={{ flex: 1, color: opts.danger ? c.danger : c.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 }}>{title}</Text>
  </Pressable>
  return <Modal transparent visible onRequestClose={close} animationType="none">
    <View style={[{ flex: 1, justifyContent: !web ? 'flex-start' : desktop ? 'center' : 'flex-end', alignItems: 'center', backgroundColor: web ? 'rgba(15,23,42,0.4)' : 'transparent', paddingTop: !web ? inset.top : 0 }, web ? ({ backdropFilter: 'blur(2px)' } as object) : null]}>
      <Pressable accessibilityLabel="Close actions" accessibilityRole="button" onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(web ? { cursor: 'default' } : {}) } as object} />
      {!web && <View style={{ width: '100%', height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: c.panel, borderBottomWidth: 1, borderColor: c.border }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close selection" onPress={close} style={{ padding: 12 }}><Icon name="back" size={24} color={c.text} /></Pressable>
        <Text style={{ flex: 1, color: c.text, fontSize: 20 }}>1</Text>
        {([{ icon: 'reply', label: 'Reply', show: m.can.reply && canReply, action: onReply }, { icon: 'info', label: 'Message information', show: own, action: onInfo }, { icon: 'trash2', label: 'Delete message', show: true, action: () => { setMore(true); setConfirm('me') } }, { icon: 'copy', label: 'Copy', show: !m.deleted && !!m.body, action: () => { void setStringAsync(m.body); close() } }, { icon: 'forward', label: 'Forward message', show: m.can.forward, action: onForward }] as { icon: IconName; label: string; show: boolean; action: () => void }[]).filter(item => item.show).map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} disabled={busy} onPress={item.action} style={{ padding: 10 }}><Icon name={item.icon} size={22} color={c.text} /></Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="More message options" onPress={() => setMore(v => !v)} style={{ padding: 10 }}><Icon name="moreVertical" size={22} color={c.text} /></Pressable>
      </View>}
      {(web || more || picking || confirm) &&       <View accessibilityViewIsModal accessibilityLabel="Message options" style={[glass(c, 4), { width: !web ? Math.min(320, width - 24) : desktop ? Math.min(384, width - 32) : '100%', alignSelf: !web ? 'flex-end' : 'center', marginRight: !web ? 8 : 0, maxHeight: height * 0.8, borderWidth: desktop ? 1 : 0, borderTopWidth: 1, borderRadius: 16, borderBottomLeftRadius: desktop ? 16 : 0, borderBottomRightRadius: desktop ? 16 : 0, overflow: 'hidden', paddingBottom: desktop ? 0 : inset.bottom }]}>
        {!desktop && <View style={{ alignSelf: 'center', marginTop: 8, width: 40, height: 4, borderRadius: 2, backgroundColor: c.dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />}
        <ScrollView keyboardShouldPersistTaps="handled">
          {m.can.react && !m.deleted && <View accessibilityLabel="React" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingHorizontal: 16, paddingVertical: 12 }}>
            {QUICK_REACTIONS.map(e => <Pressable key={e} accessibilityRole="button" accessibilityLabel={mine === e ? `Remove ${e}` : `React ${e}`} accessibilityState={{ selected: mine === e, disabled: busy }} disabled={busy} onPress={() => react(e)}
              style={({ hovered, pressed }: Hover) => [{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: mine === e ? c.successSoft : 'transparent', transform: [{ scale: pressed ? 0.9 : hovered ? 1.1 : 1 }] }, pointer]}>
              <Text style={{ fontSize: 26, lineHeight: 32 }}>{e}</Text>
            </Pressable>)}
            <Pressable accessibilityRole="button" accessibilityLabel="More emojis" accessibilityState={{ expanded: picking }} onPress={() => setPicking(p => !p)}
              style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: picking ? c.successSoft : (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }, pointer]}>
              <Icon name="plus" size={24} color={picking ? c.brand : c.muted} />
            </Pressable>
          </View>}
          {picking ? <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}>
            <TextInput selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent" autoFocus value={typed} accessibilityLabel="Type an emoji" placeholder="Type or pick any emoji 😀" placeholderTextColor={c.muted} onChangeText={value => { const emoji = firstEmoji(value); if (emoji) { setTyped(''); react(emoji) } else setTyped(value) }}
              style={[{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingStart: 16, paddingEnd: 16, paddingVertical: 12, includeFontPadding: false, color: c.text, fontSize: 16, backgroundColor: c.dark ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.9)' }, web ? ({ outlineStyle: 'none' } as object) : null]} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[...QUICK_REACTIONS, ...MORE_REACTIONS].map(e => <Pressable key={e} accessibilityRole="button" accessibilityLabel={`React ${e}`} disabled={busy} onPress={() => react(e)}
              style={({ hovered, pressed }: Hover) => [{ width: '12.5%', height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered || pressed ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }, pointer]}><Text style={{ fontSize: 24, lineHeight: 30 }}>{e}</Text></Pressable>)}</View>
          </View> : <>
            {!m.deleted && (!!m.body || m.attachments.length > 0) && <Text numberOfLines={2} style={{ marginHorizontal: 16, marginBottom: 4, marginTop: m.can.react ? 0 : 12, borderRadius: 8, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 8, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, backgroundColor: c.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>{m.body || '📎 Attachment'}</Text>}
            {confirm ? <View style={{ gap: 12, padding: 20 }}>
              <Text style={{ color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 }}>Delete this message {confirm === 'me' ? 'for you' : 'for everyone'}?</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Button title="Cancel" variant="ghost" disabled={busy} onPress={() => setConfirm(null)} /><Button title="Delete" accessibilityLabel="Confirm delete" variant="danger" loading={busy} disabled={busy} onPress={() => onDelete(confirm)} /></View>
            </View> : <View style={{ paddingVertical: 4 }}>
              {m.can.reply && canReply && row('cornerUpLeft', 'Reply', 'Reply', onReply)}
              {!m.deleted && !!m.body && row('copy', 'Copy', 'Copy', () => { void setStringAsync(m.body).catch(() => {}); close() })}
              {m.can.forward && row('forward', 'Forward', 'Forward message', onForward)}
              {exportable.map(a => row('download', `Save ${a.name}`, `Export attachment ${a.name}`, () => onExport(a)))}
              {m.can.edit && row('pencil', 'Edit', 'Edit message', onEdit, { disabled: editDisabled })}
              {own && row('info', 'Info', 'Message information', onInfo)}
              {!!mine && row('x', `Remove my reaction ${mine}`, 'Clear reaction', onUnreact)}
              {row('trash2', 'Delete for me', 'Delete for me', () => setConfirm('me'))}
              {m.can.delete_for_everyone && row('trash2', 'Delete for everyone', 'Delete for everyone', () => setConfirm('everyone'), { danger: true })}
            </View>}
          </>}
        </ScrollView>
      </View>}
    </View>
  </Modal>
}
