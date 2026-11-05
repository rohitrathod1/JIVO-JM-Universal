import { useState, type ReactNode } from 'react'
import { Image, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { shadow, useColors } from '../ui'
import { clockTime, dayLabel, formatBytes, sameDay } from '../modules/messenger/lib/text'
import type { Attachment, DeliveryStatus, ReactionSummary, ReplyPreview } from '../modules/messenger/api'
import { Icon } from './Icon'

import { chatImageLayout } from '../modules/messenger/lib/imageLayout'

const web = Platform.OS === 'web'
const pointerStyle = web ? ({ cursor: 'pointer' } as object) : null

/** Chat image tile content: the image, or an image icon when there is no URL or it fails to load (never a blank box). */
function TileImage({ uri, name }: { uri: string | null; name: string }) {
  const c = useColors()
  const [failed, setFailed] = useState<string | null>(null)
  if (!uri || failed === uri) return <View accessible accessibilityRole="image" accessibilityLabel={`${name} (preview unavailable)`} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={28} color={c.muted} /></View>
  return <Image accessibilityLabel={name} source={{ uri }} onError={() => setFailed(uri)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
}

export type MessageDelivery = DeliveryStatus | 'sending' | 'queued' | 'failed' | null
export function MessageTicks({ status }: { status: MessageDelivery }) {
  const c = useColors()
  if (!status) return null
  const label = status === 'sending' ? 'Sending' : status === 'queued' ? 'Waiting for the network' : status === 'failed' ? 'Not sent' : status[0].toUpperCase() + status.slice(1)
  return <View accessible accessibilityRole="image" accessibilityLabel={label}>
    {status === 'sending' || status === 'queued' || status === 'failed' ? <Icon name={status === 'failed' ? 'alert' : 'clock'} size={14} color={status === 'failed' ? c.danger : c.muted} /> : <Image accessible={false} source={status === 'sent' ? require('../../assets/icons/ReceiptSent.png') : require('../../assets/icons/ReceiptDouble.png')} style={{ width: 18, height: 11, tintColor: status === 'read' ? '#0ea5e9' : c.muted }} />}
  </View>
}
/** Reference bubble footer: 11px muted "edited · time · ticks", gap 4. */
export function MessageMeta({ createdAt, edited = false, status = null }: { createdAt: string; edited?: boolean; status?: MessageDelivery }) {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4 }}>
    {edited && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, color: c.muted }}>edited</Text>}
    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'], color: c.muted }}>{clockTime(createdAt)}</Text>
    <MessageTicks status={status} />
  </View>
}
/**
 * Invisible inline text as wide as the footer. Placed at the end of the message text it reserves room so the
 * absolutely placed footer sits on the last line when it fits (the reference floats it right), else on a new line.
 */
export function MessageMetaSpacer({ createdAt, edited = false, status = null }: { createdAt: string; edited?: boolean; status?: MessageDelivery }) {
  return <Text accessible={false} selectable={false} aria-hidden style={{ fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, color: 'transparent' }}>{'\u00a0'.repeat(3 + (edited ? 10 : 0) + clockTime(createdAt).length * 2 + (status ? 8 : 0))}</Text>
}
/** Put before the day's first message, outside its left/right bubble alignment. */
export function MessageDay({ createdAt, previousAt }: { createdAt: string; previousAt?: string }) {
  const c = useColors()
  if (previousAt && sameDay(createdAt, previousAt)) return null
  return <View style={{ alignItems: 'center', paddingVertical: 8 }}><View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2, backgroundColor: c.dark ? '#1e293b' : '#ffffff', boxShadow: shadow.sm }}><Text style={{ color: c.muted, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 }}>{dayLabel(createdAt)}</Text></View></View>
}
/** Shown above the first message once the whole visible history is loaded. */
export function HistoryStart({ visibleFrom }: { visibleFrom: number }) {
  const c = useColors()
  return <View style={{ height: 32, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{visibleFrom > 1 ? 'Earlier messages are not shown' : 'Beginning of the conversation'}</Text></View>
}
export function SystemNotice({ children }: { children: ReactNode }) {
  const c = useColors()
  return <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4 }}><View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, textAlign: 'center' }}>{children}</Text></View></View>
}

/** Reference "Forwarded" label: 12px italic muted with the forward arrow, above the content. */
export function ForwardedLabel() {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}><Icon name="forward" size={12} color={c.muted} /><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontStyle: 'italic', fontSize: 12, lineHeight: 16 }}>Forwarded</Text></View>
}

/** Reference Quote: 4px left bar, rounded-lg, 10/6 padding, xs text; own bubbles get a white bar on black/10. */
export function ReplyQuote({ reply, own, onJump }: { reply: ReplyPreview; own: boolean; onJump?: (seq: number) => void }) {
  const c = useColors()
  const jump = reply.seq !== null && onJump ? () => onJump(reply.seq!) : undefined
  return <Pressable accessibilityRole="button" accessibilityLabel={`Replied message from ${reply.sender_name ?? 'someone'}`} disabled={!jump} onPress={jump}
    style={[{ marginBottom: 4, borderLeftWidth: 4, borderColor: own ? 'rgba(255,255,255,0.6)' : c.brand, backgroundColor: own ? 'rgba(0,0,0,0.1)' : c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }, jump ? pointerStyle : null]}>
    <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 }}>{reply.sender_name ?? ''}</Text>
    <Text numberOfLines={2} style={{ color: c.text, fontFamily: 'Inter_400Regular', fontStyle: reply.deleted ? 'italic' : 'normal', fontSize: 12, lineHeight: 16 }}>{reply.preview}</Text>
  </Pressable>
}

/** Reference deleted text: ban glyph + italic muted 15px. */
export function DeletedText({ own, moderator = false }: { own: boolean; moderator?: boolean }) {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Icon name="ban" size={14} color={c.muted} />
    <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontStyle: 'italic', fontSize: 15, lineHeight: 20 }}>{moderator ? 'Removed by a moderator' : own ? 'You deleted this message' : 'This message was deleted'}</Text>
  </View>
}

/** Reference FileChip: rounded-[10px] black/5 row, 36px extension tile, name + size, download mark. */
export function FileChip({ attachment: a, label, onPress }: { attachment: Attachment; label: string; onPress?: () => void }) {
  const c = useColors()
  const ext = (a.name.split('.').pop() ?? '').slice(0, 4).toUpperCase()
  const detail = a.status === 'ready' ? formatBytes(a.size) : a.status === 'rejected' ? (a.reject_reason || 'Rejected') : 'Checking file…'
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress}
    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.dark ? (pressed || hovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)') : (pressed || hovered ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)') }, onPress ? pointerStyle : null]}>
    <View style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)' }}><Text style={{ color: c.muted, fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 10, lineHeight: 14 }}>{ext}</Text></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{a.name}</Text>
      <Text numberOfLines={1} style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{detail}</Text>
    </View>
    {a.status === 'ready' && <Icon name="download" size={16} color={c.muted} />}
  </Pressable>
}

/** Audio / video row in the reference player's footprint: round play button, waveform bars, length. */
export function MediaChip({ attachment: a, own, label, onPress }: { attachment: Attachment; own: boolean; label: string; onPress?: () => void }) {
  const c = useColors()
  const seconds = Math.round((a.duration_ms ?? 0) / 1000)
  const bars = [6, 10, 14, 8, 16, 12, 7, 15, 10, 13, 6, 11, 16, 9, 12, 7, 14, 10, 8, 12, 6, 9]
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 240, maxWidth: '100%', paddingVertical: 4 }, onPress ? pointerStyle : null]}>
    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: own ? '#059669' : c.brand }}><View style={{ marginLeft: 2 }}><Icon name="play" size={16} color="#ffffff" /></View></View>
    {a.kind === 'audio'
      ? <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 20 }}>{bars.map((h, i) => <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: c.dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' }} />)}</View>
      : <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{a.name}</Text>}
    {a.kind === 'audio' && <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'] }}>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</Text>}
  </Pressable>
}

/**
 * Reference Attachments: images (one sized to its ratio, several as 136px tiles in a 280px grid), media rows, file chips.
 * Thumbnails must be same-origin paths; `origin` is prefixed. Labels keep the existing test hooks.
 */
export function MessageAttachments({ items, own, origin, onImage, onMedia, onExport }: { items: Attachment[]; own: boolean; origin: string; onImage: (a: Attachment) => void; onMedia: (a: Attachment) => void; onExport: (a: Attachment) => void }) {
  const c = useColors()
  const images = items.filter(a => a.kind === 'image' && a.status === 'ready')
  const rest = items.filter(a => !images.includes(a))
  const safe = (url: string | null) => url && url.startsWith('/') && !url.startsWith('//') ? `${origin}${url}` : null
  const { width } = useWindowDimensions()
  const layout = chatImageLayout(width, images.length)
  return <View style={{ gap: 6, marginTop: 2, marginBottom: 0 }}>
    {images.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: layout.width, maxWidth: '100%' }}>
      {images.map(a => { const uri = safe(a.preview_url) || safe(a.thumb_url); const box = layout.box
        return <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`View image ${a.name}`} onPress={() => onImage(a)} style={[{ ...box, maxWidth: '100%', overflow: 'hidden', borderRadius: 10, backgroundColor: c.neutral }, pointerStyle]}>
          <TileImage uri={uri} name={a.name} />
        </Pressable> })}
    </View>}
    {rest.map(a => a.status === 'ready' && (a.kind === 'audio' || a.kind === 'video')
      ? <MediaChip key={a.id} attachment={a} own={own} label={`Open media ${a.name}`} onPress={() => onMedia(a)} />
      : <FileChip key={a.id} attachment={a} label={`Export attachment ${a.name}`} onPress={a.status === 'ready' ? () => onExport(a) : undefined} />)}
  </View>
}

/** Reference ReactionPill: on the bubble's lower edge, white pill ringed in the chat background, top 3 emoji + total. */
export function ReactionPill({ reactions, own, onPress }: { reactions: ReactionSummary[]; own: boolean; onPress?: () => void }) {
  const c = useColors()
  const total = reactions.reduce((n, r) => n + r.count, 0)
  const top = [...reactions].sort((a, b) => b.count - a.count).slice(0, 3)
  const mine = reactions.some(r => r.me)
  return <Pressable accessibilityRole="button" accessibilityLabel={`Reactions: ${reactions.map(r => `${r.emoji} ${r.count}`).join(', ')}${mine ? ', including you' : ''}`} disabled={!onPress} onPress={onPress}
    style={[{ position: 'absolute', top: '100%', marginTop: -6, ...(own ? { right: 8 } : { left: 8 }), height: 26, flexDirection: 'row', alignItems: 'center', gap: 1, borderRadius: 999, paddingHorizontal: 5, borderWidth: 2, borderColor: c.dark ? '#020617' : '#efeae2', backgroundColor: mine ? (c.dark ? '#1d3b2e' : c.successSoft) : (c.dark ? '#1e293b' : '#ffffff'), boxShadow: shadow.sm }, pointerStyle]}>
    {top.map(r => <Text key={r.emoji} style={{ fontSize: 14, lineHeight: 16 }}>{r.emoji}</Text>)}
    {total > 1 && <Text style={{ marginLeft: 2, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] }}>{total}</Text>}
  </Pressable>
}

/**
 * Reference MessageBubble shell: rounded-2xl, 12/6 padding, own bottom-right (other bottom-left) corner 6px,
 * at most 80% / 544px wide. The options chevron appears on hover or keyboard focus (web pointer); phones hold the message.
 * Optional forwarded / reply / reactions props draw the reference's label, quote and reaction pill.
 */
export function MessageBubble({ own, sender, label, meta, inlineMeta, selected = false, onActions, actionsDisabled = false, chevron = true, forwarded = false, reply = null, onJump, reactions, onReactions, onSender, children }: {
  own: boolean
  /** Group chats only, on the first message of a run. */
  sender?: string | null
  label: string
  meta: { createdAt: string; edited?: boolean; status?: MessageDelivery }
  /** True when the content ends with MessageMetaSpacer text, so the footer overlays its last line. */
  inlineMeta: boolean
  selected?: boolean
  onActions?: () => void
  actionsDisabled?: boolean
  /** The hover options arrow; off for deleted messages, which still open actions on hold. */
  chevron?: boolean
  /** Live messages only: the "Forwarded" label above the content. */
  forwarded?: boolean
  /** Live messages only: the quoted message. */
  reply?: ReplyPreview | null
  onJump?: (seq: number) => void
  /** Live messages only: drawn as the reference pill on the bubble's lower edge. */
  reactions?: ReactionSummary[]
  onReactions?: () => void
  onSender?: () => void
  children: ReactNode
}) {
  const c = useColors(); const [hover, setHover] = useState(false); const [focus, setFocus] = useState(false)
  const background = own ? c.outgoing : c.incoming
  const pill = !!reactions?.length
  return <Pressable accessibilityLabel={label} onLongPress={onActions} delayLongPress={400} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    accessibilityActions={onActions ? [{ name: 'longpress', label: 'Message actions' }] : undefined} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'longpress') onActions?.() }}
    style={[{ flexDirection: 'row', justifyContent: own ? 'flex-end' : 'flex-start', paddingHorizontal: 12, paddingTop: 2, paddingBottom: pill ? 20 : 2, backgroundColor: selected ? c.successSoft : 'transparent' }, web ? ({ cursor: 'auto' } as object) : null]}>
    <View style={{ maxWidth: '80%' }}>
      <View style={{ maxWidth: 544, borderRadius: 16, borderBottomRightRadius: own ? 6 : 16, borderBottomLeftRadius: own ? 16 : 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: background, boxShadow: shadow.sm }}>
        {!!sender && <Text numberOfLines={1} accessibilityRole={onSender ? 'button' : undefined} onPress={onSender} style={[{ color: c.brand, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16, marginBottom: 2 }, onSender ? pointerStyle : null]}>{sender}</Text>}
        {forwarded && <ForwardedLabel />}
        {reply && <ReplyQuote reply={reply} own={own} onJump={onJump} />}
        {children}
        {inlineMeta ? <View style={{ position: 'absolute', right: 12, bottom: 5 }}><MessageMeta {...meta} /></View> : <View style={{ marginTop: 2 }}><MessageMeta {...meta} /></View>}
        {web && chevron && onActions && <Pressable accessibilityRole="button" accessibilityLabel="Message actions" disabled={actionsDisabled} onPress={onActions} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={[{ position: 'absolute', right: 4, top: 4, zIndex: 10, padding: 2, borderRadius: 999, backgroundColor: background, opacity: hover || focus ? 1 : 0 }, pointerStyle]}>
          <Icon name="down" size={16} color={c.muted} />
        </Pressable>}
        {pill && <ReactionPill reactions={reactions!} own={own} onPress={onReactions} />}
      </View>
    </View>
  </Pressable>
}
