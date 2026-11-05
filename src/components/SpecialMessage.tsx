import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native'
import { answerEvent, eventAnswers as fetchAnswers, getWindow, updateEvent, type Message, type PersonCard } from '../modules/messenger/api'
import { ChatAvatar } from './ChatAvatar'
import { eventAnswers } from '../modules/messenger/specialContent'
import { mapsUrl } from '../modules/messenger/location/model'
import { eventWhen, icsFor, reminderLabel } from '../modules/messenger/lib/events'
import { safeSharedLink } from '../modules/messenger/sharedMedia'
import { saveAttachment } from '../modules/messenger/media/export'
import { errorMessage } from '../core/api/client'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { useResource } from '../shared/useResource'
import { Button, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
import { Icon, type IconName } from './Icon'
import { EventEditor } from './EventComposer'
import { LocationMap } from './LocationMap'
const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null

export function SpecialMessage({ message, onChanged }: { message: Message; onChanged: () => void }) {
  const c = useColors(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [answers, setAnswers] = useState(false); const [editing, setEditing] = useState(false); const [confirmCancel, setConfirmCancel] = useState(false)
  const alive = useRef(true); const foreground = useRef(true)
  useEffect(() => { alive.current = true; const off = subscribeSensitiveView(active => { foreground.current = active; if (!active) { setAnswers(false); setEditing(false); setConfirmCancel(false) } }); return () => { alive.current = false; off() } }, [])
  if (message.deleted || (!message.location && !message.event)) return null
  const location = message.location; const event = message.event
  const map = location ? mapsUrl(location) : null
  const eventMap = event?.place_point ? mapsUrl(event.place_point) : null
  async function run(work: () => Promise<unknown>) {
    if (busy || !foreground.current) return
    setBusy(true); setError('')
    try { await work(); if (alive.current && foreground.current) onChanged() }
    catch (e) { if (alive.current && foreground.current) setError(errorMessage(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  async function calendar() {
    const page = await getWindow(message.conversation, { around: message.seq })
    const current = page.results.find(item => item.id === message.id && !item.deleted && item.event && !item.event.cancelled && (!item.expires_at || Date.parse(item.expires_at) > Date.now()))
    if (!current?.event) throw new Error('This event is no longer available.')
    const active = () => alive.current && foreground.current
    if (!active()) return
    const name = current.event.title.replace(/[^\w -]+/g, '').trim() || 'event'
    await saveAttachment(new Blob([icsFor(current.id, current.event)], { type: 'text/calendar' }), `${name}.ics`, active)
  }
  const start = event ? new Date(event.starts_at) : null
  const total = event ? Object.values(event.counts).reduce((sum, count) => sum + count, 0) : 0
  return <View style={{ gap: 8, maxWidth: 340 }}>
    {location && <View style={{ width: 288, maxWidth: '100%', paddingVertical: 4 }}>{map && <View style={{ borderRadius: 8, overflow: 'hidden' }}><LocationMap center={location} height={144} /></View>}<Text style={{ marginTop: 6, color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20 }}>{location.name || (location.address ? '' : 'Location')}</Text>{!!location.address && <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{location.address}</Text>}{map && <Pressable accessibilityRole="link" accessibilityLabel={`Open ${location.name || 'this location'} in Maps`} onPress={() => void Linking.openURL(map).catch(e => setError(errorMessage(e)))} style={[{ marginTop: 4, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }, pointer]}><Icon name="externalLink" size={12} color={c.brand} /><Text style={{ color: c.brand, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 }}>Open in Maps</Text></Pressable>}</View>}
    {event && <View style={{ width: 304, maxWidth: '100%', paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View accessible={false} style={{ width: 48, flexShrink: 0, borderRadius: 8, borderWidth: 1, borderColor: event.cancelled ? c.border : (c.dark ? 'rgba(34,197,94,0.4)' : 'rgba(22,163,74,0.4)'), overflow: 'hidden', alignItems: 'center', opacity: event.cancelled ? 0.6 : 1 }}>
          <Text style={{ backgroundColor: event.cancelled ? '#94a3b8' : c.brand, color: '#fff', width: '100%', textAlign: 'center', fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 10, lineHeight: 15, paddingVertical: 2 }}>{start?.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</Text>
          <Text style={{ color: c.text, fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 18, lineHeight: 22.5, paddingVertical: 2 }}>{start?.getDate()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 15, lineHeight: 20.625, textDecorationLine: event.cancelled ? 'line-through' : 'none', opacity: event.cancelled ? 0.7 : 1 }}>{event.title}</Text>
          {event.cancelled && <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="ban" size={12} color={c.danger} /><Text style={{ color: c.danger, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 }}>Event cancelled</Text></View>}
        </View>
      </View>
      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><View style={{ marginTop: 2 }}><Icon name="clock" size={16} color={c.muted} /></View><Text style={{ flex: 1, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{eventWhen(event.starts_at, event.ends_at)}</Text></View>
      {!!event.place && <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><View style={{ marginTop: 2 }}><Icon name="mapPin" size={16} color={c.muted} /></View>
        {eventMap ? <Text accessibilityRole="link" accessibilityLabel={`Open ${event.place} in Maps`} onPress={() => void Linking.openURL(eventMap).catch(e => setError(errorMessage(e)))} style={[{ flex: 1, color: c.brand, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }, pointer]}>{event.place}</Text>
          : <Text style={{ flex: 1, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{event.place}</Text>}</View>}
      {!!event.description && <Text style={{ marginTop: 6, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{event.description}</Text>}
      {!event.cancelled && <>
        {event.reminder_minutes !== null && event.reminder_minutes !== undefined && <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="bell" size={14} color={c.muted} /><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>Reminder: {reminderLabel(event.reminder_minutes).toLowerCase()}</Text></View>}
        {safeSharedLink(event.link) && <Pressable accessibilityRole="button" accessibilityLabel="Join meeting" onPress={() => void Linking.openURL(safeSharedLink(event.link)!).catch(e => setError(errorMessage(e)))}
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, paddingVertical: 8, backgroundColor: c.brand, opacity: hovered || pressed ? 0.9 : 1 }, pointer]}>
          <Icon name="video" size={16} color="#ffffff" /><Text style={{ color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 14, lineHeight: 20 }}>Join meeting</Text>
        </Pressable>}
        <View style={{ marginTop: 10, flexDirection: 'row', gap: 4 }}>{eventAnswers.map(answer => { const mine = event.my_answer === answer.value; const off = busy || !message.can.respond
          return <Pressable key={answer.value} accessibilityRole="button" accessibilityLabel={`${answer.label} (${event.counts[answer.value]})${mine ? ' selected' : ''}`} accessibilityState={{ disabled: off, selected: mine }} disabled={off} onPress={() => void run(() => answerEvent(message.id, mine ? null : answer.value))}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [{ flex: 1, alignItems: 'center', gap: 2, borderRadius: 8, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 6, borderColor: mine ? c.brand : (c.dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'), backgroundColor: mine ? c.brand : (hovered || pressed) && !off ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }, off ? null : pointer]}>
            <Icon name={answer.value === 'going' ? 'check' : answer.value === 'maybe' ? 'helpCircle' : 'x'} size={16} color={mine ? '#ffffff' : c.text} />
            <Text style={{ color: mine ? '#ffffff' : c.text, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 }}>{answer.value === 'not_going' ? 'Not going' : answer.label}</Text>
            <Text style={{ color: mine ? 'rgba(255,255,255,0.9)' : c.muted, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] }}>{event.counts[answer.value]}</Text>
          </Pressable> })}</View>
      </>}
      <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 }}>
        <CardLink label="View event responses" title={total === 0 ? 'No answers yet' : `View answers · ${total}`} disabled={busy} onPress={() => setAnswers(true)} />
        {!event.cancelled && <CardLink label="Add to calendar" title="Add to calendar" icon="calendarPlus" disabled={busy} onPress={() => void run(calendar)} />}
        {message.can.edit_event && !event.cancelled && <><CardLink label="Edit event" title="Edit" icon="pencil" iconSize={14} disabled={busy} onPress={() => setEditing(true)} /><CardLink label="Cancel event" title="Cancel event" icon="ban" iconSize={14} danger disabled={busy} onPress={() => setConfirmCancel(true)} /></>}
      </View>
      {answers && <EventResponses message={message} onClose={() => setAnswers(false)} />}
      {editing && <EventEditor message={message} onSaved={() => { onChanged(); setEditing(false) }} onClose={() => setEditing(false)} />}
      {confirmCancel && <Sheet visible onClose={() => { if (!busy) setConfirmCancel(false) }}><Label large>Cancel event?</Label><Label>{event.title}</Label><Label>The event and existing responses remain in the conversation.</Label><Button title="Confirm cancel event" disabled={busy} onPress={() => void run(async () => { await updateEvent(message.id, { cancel: true }); if (alive.current) setConfirmCancel(false) })} /><Button title="Keep event" variant="secondary" disabled={busy} onPress={() => setConfirmCancel(false)} /></Sheet>}
    </View>}
    {!!error && <Label>{error}</Label>}
  </View>
}
/** Reference card footer action: 14px medium brand text, optional leading icon, fades on hover. */
export function CardLink({ title, label, onPress, disabled = false, icon, iconSize = 16, danger = false }: { title: string; label: string; onPress: () => void; disabled?: boolean; icon?: IconName; iconSize?: number; danger?: boolean }) {
  const c = useColors(); const color = danger ? c.danger : c.brand
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: disabled ? 0.5 : hovered || pressed ? 0.8 : 1 }, disabled ? null : pointer]}>
    {icon && <Icon name={icon} size={iconSize} color={color} />}<Text style={{ color, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{title}</Text>
  </Pressable>
}
function EventResponses({ message, onClose }: { message: Message; onClose: () => void }) {
  const load = useCallback(() => fetchAnswers(message.id), [message.id]); const resource = useResource(load)
  const { refresh } = resource
  useEffect(() => { refresh() }, [message.updated_at, refresh])
  return <Sheet visible onClose={onClose}><Label large>{message.event?.title ?? 'Answers'}</Label>{resource.loading && <ActivityIndicator />}
    {!!resource.error && <><Label>{errorMessage(resource.error)}</Label><Button title="Retry event responses" onPress={resource.refresh} /></>}
    {resource.value?.map(group => <View key={group.answer} style={{ gap: 6 }}><Label>{group.answer === 'not_going' ? 'Not going' : eventAnswers.find(item => item.value === group.answer)?.label} · {group.users.length}</Label>{group.users.length ? group.users.map(user => <Label key={user.id}>{user.name}</Label>) : <Label>Nobody</Label>}</View>)}
    <Button title="Close event responses" variant="ghost" onPress={onClose} />
  </Sheet>
}

/** Reference PollCard: chart-icon question, "Select one" hint, round (or square) checks with bars, "View votes" footer. */
export function PollCard({ message, own, disabled = false, onVote, onVoters }: { message: Message; own: boolean; disabled?: boolean; onVote: (optionIds: string[]) => void; onVoters: () => void }) {
  const c = useColors(); const poll = message.poll!
  const canVote = Boolean(message.can.vote) && !disabled
  const mine = poll.options.filter(o => o.me).map(o => o.id)
  const most = Math.max(1, ...poll.options.map(o => o.votes))
  const choose = (id: string) => { if (!canVote) return; onVote(poll.allow_multiple ? (mine.includes(id) ? mine.filter(x => x !== id) : [...mine, id]) : (mine.includes(id) ? [] : [id])) }
  const line = c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  return <View style={{ width: 288, maxWidth: '100%', paddingVertical: 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}><View style={{ marginTop: 2 }}><Icon name="barChart3" size={16} color={c.brand} /></View><Text style={{ flex: 1, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 15, lineHeight: 20.625 }}>{poll.question}</Text></View>
    <Text style={{ marginTop: 2, marginBottom: 8, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{poll.allow_multiple ? 'Select one or more' : 'Select one'}</Text>
    <View accessibilityRole={poll.allow_multiple ? undefined : 'radiogroup'} accessibilityLabel={poll.question} style={{ gap: 8 }}>
      {poll.options.map(o => <Pressable key={o.id} accessibilityRole={poll.allow_multiple ? 'checkbox' : 'radio'} accessibilityLabel={`${o.text} (${o.votes})${o.me ? ' • selected' : ''}`} aria-checked={o.me} accessibilityState={{ checked: o.me, disabled: !canVote }} disabled={!canVote} onPress={() => choose(o.id)} style={canVote ? pointer : null}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 20, height: 20, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: poll.allow_multiple ? 4 : 10, borderColor: o.me ? c.brand : (c.dark ? 'rgba(203,213,225,0.6)' : 'rgba(71,85,105,0.6)'), backgroundColor: o.me ? c.brand : 'transparent' }}>{o.me && <Icon name="check" size={12} color="#ffffff" />}</View>
          <Text style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{o.text}</Text>
          <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] }}>{o.votes}</Text>
        </View>
        <View style={{ marginLeft: 28, marginTop: 4, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: c.dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}><View style={{ width: `${(o.votes / most) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: own ? '#059669' : c.brand }} /></View>
      </Pressable>)}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`View votes (${poll.voters})`} onPress={onVoters}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: line, alignItems: 'center', opacity: hovered || pressed ? 0.8 : 1 }, pointer]}>
      <Text style={{ color: c.brand, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{poll.voters === 0 ? 'No votes yet' : `View votes · ${poll.voters} ${poll.voters === 1 ? 'person' : 'people'}, ${poll.total_votes} ${poll.total_votes === 1 ? 'vote' : 'votes'}`}</Text>
    </Pressable>
  </View>
}

/** Reference ContactCard: 44px avatar, name and company, then Message / View split by a hairline. */
export function ContactCard({ person, onProfile, onMessage }: { person: PersonCard; onProfile: () => void; onMessage?: () => void }) {
  const c = useColors(); const line = c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const action = (title: string, label: string, icon: IconName, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 4, paddingVertical: 4, backgroundColor: hovered || pressed ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }, pointer]}>
    <Icon name={icon} size={16} color={c.brand} /><Text style={{ color: c.brand, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{title}</Text>
  </Pressable>
  return <View style={{ width: 256, maxWidth: '100%', paddingVertical: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Contact: ${person.name}`} onPress={onProfile} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, pointer]}>
      <ChatAvatar name={person.name} seed={person.id} uri={person.avatar_url} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 15, lineHeight: 20.625 }}>{person.name}</Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{person.company ?? 'JIVO'}</Text>
      </View>
    </Pressable>
    <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: line, flexDirection: 'row', gap: 4 }}>
      {action('Message', `Message ${person.name}`, 'messageCircle', onMessage ?? onProfile)}
      {action('View', `View ${person.name}`, 'user', onProfile)}
    </View>
  </View>
}
