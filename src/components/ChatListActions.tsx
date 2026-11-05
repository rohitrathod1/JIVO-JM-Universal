import { useSession } from '../core/auth/Session'
import { isSelfChat } from '../modules/messenger/lib/selfChat'
import { useEffect, useState, type ReactNode } from 'react'
import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as chat from '../modules/messenger/api'
import { isMuted } from '../modules/messenger/lib/text'
import { realtime } from '../core/realtime/socket'
import { errorMessage } from '../core/api/client'
import { Button, glass, useColors } from '../ui'
import { Icon, type IconName } from './Icon'
import { Sheet } from './Sheet'

const web = Platform.OS === 'web'
const pointer = (web ? { cursor: 'pointer' } : {}) as object
const hoveredOf = (state: object) => Boolean((state as { hovered?: boolean }).hovered)

/**
 * Which chats someone is typing in, for the list rows (reference useTyping per row). A TYPING_STARTED frame lasts
 * 6 s unless renewed; TYPING_STOPPED clears it. Frames from this person (other devices) are ignored.
 */
export function useListTyping(me: string): Set<string> {
  const [typing, setTyping] = useState<Record<string, Record<string, number>>>({})
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => realtime.on<{ conversation?: string; user?: string }>('*', ({ type, data }) => {
    if ((type !== 'TYPING_STARTED' && type !== 'TYPING_STOPPED') || !data?.conversation || !data.user || data.user === me) return
    const time = Date.now(); setNow(time)
    setTyping(old => ({ ...old, [data.conversation!]: { ...old[data.conversation!], [data.user!]: type === 'TYPING_STARTED' ? time + 6000 : 0 } }))
  }), [me])
  const active = Object.entries(typing).filter(([, users]) => Object.values(users).some(until => until > now)).map(([id]) => id)
  useEffect(() => {
    if (!active.length) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active.length])
  return new Set(active)
}

/** Reference MessageSheets Sheet: glass-4 bottom sheet with a grab handle on phones, a centred 24rem card from md. */
export function ListSheet({ visible, onClose, label, children }: { visible: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const c = useColors(); const { width, height } = useWindowDimensions(); const inset = useSafeAreaInsets(); const wide = width >= 768
  if (!visible) return null
  return <Modal transparent visible onRequestClose={onClose} animationType="none">
    <View style={[{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', alignItems: wide ? 'center' : 'stretch', padding: wide ? 16 : 0 }]}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)' }, web ? ({ backdropFilter: 'blur(2px)', cursor: 'default' } as object) : null]} />
      <View accessibilityViewIsModal accessibilityLabel={label} style={[glass(c, 4), { maxHeight: height * 0.8, width: wide ? Math.min(384, width - 32) : '100%', borderRadius: 16, borderBottomLeftRadius: wide ? 16 : 0, borderBottomRightRadius: wide ? 16 : 0, borderWidth: 1, overflow: 'hidden', paddingBottom: wide ? 0 : inset.bottom }]}>
        {!wide && <View style={{ alignSelf: 'center', marginTop: 8, width: 40, height: 4, borderRadius: 2, backgroundColor: c.dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />}
        <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>{children}</ScrollView>
      </View>
    </View>
  </Modal>
}

/** Reference SheetRow: gap-4 px-5 py-3, 15px label, muted 20px icon; danger rows are red. */
export function SheetRow({ icon, label, onPress, danger = false }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={state => ({ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: state.pressed ? (c.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)') : hoveredOf(state) ? (c.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent', ...pointer })}>
    <Icon name={icon} size={20} color={c.muted} />
    <Text style={{ color: danger ? c.danger : c.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 }}>{label}</Text>
  </Pressable>
}

/** Reference ConfirmDialog: title, body, Cancel and a (danger) confirm button. */
export function ConfirmSheet({ visible, title, body, confirmLabel, onConfirm, onClose, danger = true }: { visible: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  const c = useColors()
  return <Sheet visible={visible} onClose={onClose} title={title}>
    <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{body}</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
      <Button variant="secondary" title="Cancel" onPress={onClose} />
      <Button variant={danger ? 'danger' : 'primary'} title={confirmLabel} onPress={onConfirm} />
    </View>
  </Sheet>
}

export interface Choice<T extends string> { value: T; label: string; description?: string }
/** Reference ChoiceDialog: a radio list of bordered rows; Apply is enabled once the pick differs from the saved value. */
export function ChoiceSheet<T extends string>({ visible, title, description, choices, value, onApply, onClose }: { visible: boolean; title: string; description?: string; choices: Choice<T>[]; value: T; onApply: (value: T) => Promise<unknown>; onClose: () => void }) {
  const c = useColors(); const [picked, setPicked] = useState(value); const [busy, setBusy] = useState(false)
  const [synced, setSynced] = useState({ visible, value })
  if (synced.visible !== visible || synced.value !== value) { setSynced({ visible, value }); if (visible) setPicked(value) }
  return <Sheet visible={visible} onClose={onClose} title={title}>
    {!!description && <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{description}</Text>}
    <View accessibilityRole="radiogroup" accessibilityLabel={title} style={{ gap: 6 }}>
      {choices.map(choice => { const on = choice.value === picked; return <Pressable key={choice.value} accessibilityRole="radio" accessibilityLabel={choice.label} aria-checked={on} accessibilityState={{ checked: on }} onPress={() => setPicked(choice.value)} style={state => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 10, borderWidth: 1, borderColor: on ? c.brand : c.border, backgroundColor: on ? c.successSoft : hoveredOf(state) ? (c.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent', paddingHorizontal: 12, paddingVertical: 10, ...pointer })}>
        <View style={{ marginTop: 2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? c.brand : c.muted, backgroundColor: on ? c.brand : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.6 }}>{on && <Icon name="check" size={12} color="#ffffff" />}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{choice.label}</Text>
          {!!choice.description && <Text style={{ marginTop: 2, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{choice.description}</Text>}
        </View>
      </Pressable> })}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
      <Button variant="secondary" title="Cancel" onPress={onClose} />
      <Button title="Apply" loading={busy} disabled={busy || picked === value} onPress={() => { setBusy(true); void onApply(picked).then(onClose, () => {}).finally(() => setBusy(false)) }} />
    </View>
  </Sheet>
}

export const NOTIFY_CHOICES: Choice<'default' | chat.NotifyPreview | 'muted'>[] = [
  { value: 'default', label: 'Default', description: 'Use your setting from Notifications.' },
  { value: 'none', label: 'New message only', description: 'No name, no text.' },
  { value: 'sender', label: 'Sender name', description: 'Who wrote, not what.' },
  { value: 'sender_and_text', label: 'Sender + message', description: 'Who wrote and the start of the message.' },
  { value: 'muted', label: 'Muted', description: 'No notifications from this chat (mentions still come through).' },
]
export const DISAPPEARING_CHOICES: Choice<string>[] = [{ value: '0', label: 'Off' }, { value: String(24 * 3600), label: '24 hours' }, { value: String(7 * 24 * 3600), label: '7 days' }, { value: String(90 * 24 * 3600), label: '90 days' }]

type Confirm = 'clear' | 'delete' | 'leave' | null
const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

/** Reference ChatListActions: hold (phones) or right-click (desktop) a chat row: pin, mute, archive, mark read, clear, delete, exit. */
export function ChatListActions({ chat: item, onClose, onChanged, onDeleted, onError }: { chat: chat.ConversationItem | null; onClose: () => void; onChanged: () => void; onDeleted: (id: string) => void; onError: (message: string) => void }) {
  const { me } = useSession(); const self = isSelfChat(item, me?.id)
  const c = useColors(); const [confirm, setConfirm] = useState<Confirm>(null); const [target, setTarget] = useState<chat.ConversationItem | null>(null)
  const run = async (fn: () => Promise<unknown>) => { onClose(); try { await fn() } catch (e) { onError(errorMessage(e)) } finally { onChanged() } }
  const ask = (what: Confirm) => { setTarget(item); setConfirm(what); onClose() }
  const muted = item ? isMuted(item.muted_until) : false
  const title = (x: chat.ConversationItem | null) => x?.title || x?.peer?.name || ''
  return <>
    <ListSheet visible={item !== null} onClose={onClose} label="Chat options">
      {item && <>
        <Text numberOfLines={1} style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 14, lineHeight: 20 }}>{title(item)}</Text>
        {item.unread_count > 0 && <SheetRow icon="checks" label="Mark as read" onPress={() => void run(() => chat.markRead(item.id, item.last_seq))} />}
        <SheetRow icon={item.pinned_at ? 'pinOff' : 'pin'} label={item.pinned_at ? 'Unpin' : 'Pin to top'} onPress={() => void run(() => chat.updateSettings(item.id, { pinned: !item.pinned_at }))} />
        {!self && (muted ? <SheetRow icon="bellRing" label="Unmute" onPress={() => void run(() => chat.updateSettings(item.id, { muted_until: null }))} /> : <>
          <SheetRow icon="bellOff" label="Mute for 8 hours" onPress={() => void run(() => chat.updateSettings(item.id, { muted_until: hours(8) }))} />
          <SheetRow icon="bellOff" label="Mute always" onPress={() => void run(() => chat.updateSettings(item.id, { muted_until: 'forever' }))} />
        </>)}
        <SheetRow icon={item.archived_at ? 'archiveRestore' : 'archive'} label={item.archived_at ? 'Unarchive' : 'Archive'} onPress={() => void run(() => chat.updateSettings(item.id, { archived: !item.archived_at }))} />
        <SheetRow icon="eraser" label="Clear chat" danger onPress={() => ask('clear')} />
        {item.kind === 'group' && !item.left ? <SheetRow icon="logout" label="Exit group" danger onPress={() => ask('leave')} /> : <SheetRow icon="trash2" label="Delete chat" danger onPress={() => ask('delete')} />}
      </>}
    </ListSheet>
    <ConfirmSheet visible={confirm === 'clear'} onClose={() => setConfirm(null)} title={`Clear the chat with ${title(target)}?`} body="Messages so far are hidden for you only. Others still see them." confirmLabel="Clear chat" onConfirm={() => { setConfirm(null); if (target) void run(() => chat.clearChat(target.id)) }} />
    <ConfirmSheet visible={confirm === 'delete'} onClose={() => setConfirm(null)} title={`Delete the chat with ${title(target)}?`} body="Its messages are cleared for you and it leaves your list (it is archived). It comes back if a new message arrives. Others still see the conversation." confirmLabel="Delete chat" onConfirm={() => { setConfirm(null); if (target) void run(async () => { await chat.clearChat(target.id); await chat.updateSettings(target.id, { archived: true }); onDeleted(target.id) }) }} />
    <ConfirmSheet visible={confirm === 'leave'} onClose={() => setConfirm(null)} title={`Exit “${title(target)}”?`} body="You stop receiving its messages. You can still read what was sent while you were a member." confirmLabel="Exit group" onConfirm={() => { setConfirm(null); if (target) void run(() => chat.leaveConversation(target.id)) }} />
  </>
}
