import { useSession } from '../core/auth/Session'
import { isSelfChat } from '../modules/messenger/lib/selfChat'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import * as chat from '../modules/messenger/api'
import { chatLock } from '../modules/messenger/chatLock'
import { isMuted } from '../modules/messenger/lib/text'
import { errorMessage } from '../core/api/client'
import { useColors } from '../ui'
import { Icon, type IconName } from './Icon'
import { ChoiceSheet, DISAPPEARING_CHOICES, NOTIFY_CHOICES } from './ChatListActions'

export function ChatProfileSettings({ detail, onUpdated }: { detail: chat.ConversationDetail; onUpdated: (detail: chat.ConversationDetail) => void }) {
  const { me } = useSession(); const self = isSelfChat(detail, me?.id)
  const c = useColors(); const [choice, setChoice] = useState<'notify' | 'timer' | 'mute' | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function update(action: () => Promise<chat.ConversationDetail>) {
    setBusy(true); setError('')
    try { onUpdated(await action()) } catch (e) { setError(errorMessage(e)); throw e } finally { setBusy(false) }
  }
  const row = (icon: IconName, title: string, note: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={busy} onPress={onPress} style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.border, opacity: busy ? 0.5 : 1, backgroundColor: pressed ? c.hover : 'transparent' })}><Icon name={icon} size={20} color={c.muted} /><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 15 }}>{title}</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>{note}</Text></View><Icon name="chevronRight" size={16} /></Pressable>
  return <View style={{ gap: 8 }}>
    <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>CHAT SETTINGS</Text>
    {!self && row('bell', 'Notifications', 'Message previews and alerts', () => setChoice('notify'))}
    {!self && row('bellOff', 'Mute notifications', isMuted(detail.muted_until) ? 'On' : 'Off', () => setChoice('mute'))}
    {!self && detail.can.set_disappearing && row('timer', 'Disappearing messages', DISAPPEARING_CHOICES.find(option => option.value === String(detail.disappearing_seconds ?? 0))?.label ?? 'Off', () => setChoice('timer'))}
    {row(detail.locked ? 'unlock' : 'lock', detail.locked ? 'Unlock chat' : 'Lock chat', 'Protect this conversation on this device', () => { void update(async () => { const next = await chatLock.setLocked(detail.id, !detail.locked); if (!next) throw Error('Chat lock change was cancelled.'); return next }).catch(() => {}) })}
    {row('archive', detail.archived_at ? 'Unarchive' : 'Archive', detail.archived_at ? 'Move to your chat list' : 'Move to archived chats', () => { void update(() => chat.updateSettings(detail.id, { archived: !detail.archived_at })).catch(() => {}) })}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 13 }}>{error}</Text>}
    <ChoiceSheet visible={!self && choice === 'notify'} title="Notifications" description={error || undefined} choices={NOTIFY_CHOICES} value={isMuted(detail.muted_until) ? 'muted' : detail.notify_preview ?? 'default'} onClose={() => setChoice(null)} onApply={value => update(() => chat.updateSettings(detail.id, value === 'muted' ? { muted_until: 'forever' } : { muted_until: null, notify_preview: value === 'default' ? null : value }))} />
    <ChoiceSheet visible={!self && choice === 'timer'} title="Disappearing messages" description={error || "Applies to new messages for everyone in this chat."} choices={DISAPPEARING_CHOICES} value={String(detail.disappearing_seconds ?? 0)} onClose={() => setChoice(null)} onApply={value => update(() => chat.setDisappearing(detail.id, Number(value) as Parameters<typeof chat.setDisappearing>[1]))} />
    <ChoiceSheet visible={!self && choice === 'mute'} title="Mute notifications" description={error || undefined} choices={[...(isMuted(detail.muted_until) ? [{ value: 'current', label: 'Keep current mute' }] : []), { value: 'off', label: 'Unmute' }, { value: '8', label: 'For 8 hours' }, { value: '168', label: 'For 1 week' }, { value: 'forever', label: 'Always' }]} value={isMuted(detail.muted_until) ? 'current' : 'off'} onClose={() => setChoice(null)} onApply={value => update(() => chat.updateSettings(detail.id, { muted_until: value === 'current' ? detail.muted_until : value === 'off' ? null : value === 'forever' ? 'forever' : new Date(Date.now() + Number(value) * 3600000).toISOString() }))} />
  </View>
}
