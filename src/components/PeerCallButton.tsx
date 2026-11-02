import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, Linking, Pressable, Text, View } from 'react-native'
import { getPerson, type ConversationItem, type PersonProfile } from '../modules/messenger/api'
import { dialablePeer, headerInfo } from '../modules/messenger/conversationInfo'
import { mediaUrl } from '../modules/messenger/media/url'
import { useResource } from '../shared/useResource'
import { safeTelHref } from '../shared/phone'
import { realtime } from '../core/realtime/socket'
import { errorMessage, origin } from '../core/api/client'
import { Label, useColors } from '../ui'
import { ChatAvatar } from './ChatAvatar'

// Lucide Phone / Mail (the Frontend's icons), rasterized at 3x like the other assets/icons.
const contactIcons = { phone: require('../../assets/icons/Phone.png'), mail: require('../../assets/icons/Mail.png') } as const

/** A round contact action: `soft` is the green chip of the profile rows, otherwise a plain header icon button. */
export function RoundAction({ icon, label, onPress, disabled = false, soft = false }: { icon: keyof typeof contactIcons; label: string; onPress: () => void; disabled?: boolean; soft?: boolean }) {
  const c = useColors(); const size = soft ? 36 : 44
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    hitSlop={soft ? 4 : 0} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: soft ? c.soft : pressed ? c.neutral : 'transparent', opacity: disabled ? 0.45 : pressed && soft ? 0.8 : 1 })}>
    <Image accessible={false} source={contactIcons[icon]} style={{ width: soft ? 16 : 22, height: soft ? 16 : 22, tintColor: soft ? c.primary : c.muted }} />
  </Pressable>
}

/** The server decides whether this person may see the number. This opens the OS dialer, not a JM call. */
export function ProfileCallButton({ profile, soft = false, label }: { profile: PersonProfile; soft?: boolean; label?: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  if (!profile.is_active || !safeTelHref(profile.phone)) return null
  async function dial() {
    if (busy) return
    setBusy(true); setError('')
    try {
      // Re-check privacy/active status at the action, rather than relying on an old profile response.
      const current = await getPerson(profile.id)
      const href = current.is_active ? safeTelHref(current.phone) : null
      if (!alive.current) return
      if (!href) throw new Error('This mobile number is no longer available.')
      await Linking.openURL(href)
    } catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  return <View style={{ alignItems: 'flex-end', gap: 4 }}><RoundAction icon="phone" soft={soft} label={label ?? `Call ${profile.phone}`} disabled={busy} onPress={() => void dial()} />{!!error && <Label>{error}</Label>}</View>
}

/** Chat header: a phone button only for a direct chat with an active peer whose phone the server shows you. */
export function PeerCallButton({ conversation }: { conversation: ConversationItem }) {
  const peer = dialablePeer(conversation)
  const load = useCallback(() => peer ? getPerson(peer) : Promise.resolve(null), [peer])
  const resource = useResource(load)
  useEffect(() => realtime.on('RESYNC', resource.refresh), [resource.refresh])
  return peer && resource.value ? <ProfileCallButton key={peer} profile={resource.value} label={`Call ${conversation.title || conversation.peer?.name} on ${resource.value.phone}`} /> : null
}

/** Chat header identity: avatar, the server's title (a chat with yourself is "<your name> (You)") and the live or info line. Tapping opens the chat's info. */
export function ChatHeaderTitle({ conversation, live, onPress }: { conversation: ConversationItem; live?: string | null; onPress: () => void }) {
  const c = useColors(); const title = conversation.title || conversation.peer?.name || 'Conversation'; const info = live || headerInfo(conversation)
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${conversation.kind === 'group' ? 'group info' : 'profile'}`} onPress={onPress}
    style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, opacity: pressed ? 0.75 : 1 })}>
    <ChatAvatar name={title} seed={conversation.peer?.id ?? conversation.id} uri={mediaUrl(conversation.avatar_url, origin)} group={conversation.kind === 'group'} size={40} />
    <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 24 }}>{title}</Text>{!!info && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{info}</Text>}</View>
  </Pressable>
}
