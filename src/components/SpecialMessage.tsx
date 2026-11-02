import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Text, View } from 'react-native'
import { answerEvent, eventAnswers as fetchAnswers, getWindow, updateEvent, type Message } from '../modules/messenger/api'
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
import { EventEditor } from './EventComposer'
import { LocationMap } from './LocationMap'

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
  return <View style={{ gap: 8, maxWidth: 340 }}>
    {location && <>{map && <LocationMap center={location} height={144} />}<Label large>{location.name || 'Location'}</Label>{!!location.address && <Label>{location.address}</Label>}{map && <Button title="Open in Maps" accessibilityLabel={`Open ${location.name || 'this location'} in Maps`} variant="ghost" onPress={() => void Linking.openURL(map).catch(e => setError(errorMessage(e)))} />}</>}
    {event && <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 48, borderRadius: 8, borderWidth: 1, borderColor: c.primary, overflow: 'hidden', alignItems: 'center', opacity: event.cancelled ? 0.6 : 1 }}><Text style={{ backgroundColor: c.primary, color: '#fff', width: '100%', textAlign: 'center', fontSize: 10, paddingVertical: 3 }}>{start?.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</Text><Text style={{ color: c.text, fontSize: 22, paddingVertical: 2 }}>{start?.getDate()}</Text></View>
        <View style={{ flex: 1 }}><Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 16, textDecorationLine: event.cancelled ? 'line-through' : 'none' }}>{event.title}</Text>{event.cancelled && <Text style={{ color: c.danger }}>Event cancelled</Text>}</View>
      </View>
      <Label>{eventWhen(event.starts_at, event.ends_at)}</Label>
      {!!event.place && (eventMap ? <Button title={event.place} accessibilityLabel={`Open ${event.place} in Maps`} variant="ghost" onPress={() => void Linking.openURL(eventMap).catch(e => setError(errorMessage(e)))} /> : <Label>{event.place}</Label>)}
      {!!event.description && <Label>{event.description}</Label>}
      {!event.cancelled && <>
        {event.reminder_minutes !== null && event.reminder_minutes !== undefined && <Label>Reminder: {reminderLabel(event.reminder_minutes).toLowerCase()}</Label>}
        {safeSharedLink(event.link) && <Button title="Join meeting" onPress={() => void Linking.openURL(safeSharedLink(event.link)!).catch(e => setError(errorMessage(e)))} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{eventAnswers.map(answer => <View key={answer.value} style={{ flex: 1, minWidth: 78 }}><Button title={`${answer.value === 'not_going' ? 'Not going' : answer.label}\n${event.counts[answer.value]}`} accessibilityLabel={`${answer.label} (${event.counts[answer.value]})${event.my_answer === answer.value ? ' selected' : ''}`} variant={event.my_answer === answer.value ? 'primary' : 'secondary'} disabled={busy || !message.can.respond} onPress={() => void run(() => answerEvent(message.id, event.my_answer === answer.value ? null : answer.value))} /></View>)}</View>
      </>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}><Button title={`View answers · ${Object.values(event.counts).reduce((sum, count) => sum + count, 0)}`} accessibilityLabel="View event responses" variant="ghost" disabled={busy} onPress={() => setAnswers(true)} />
        {!event.cancelled && <Button title="Add to calendar" variant="ghost" disabled={busy} onPress={() => void run(calendar)} />}
        {message.can.edit_event && !event.cancelled && <><Button title="Edit event" variant="ghost" disabled={busy} onPress={() => setEditing(true)} /><Button title="Cancel event" variant="ghost" disabled={busy} onPress={() => setConfirmCancel(true)} /></>}
      </View>
      {answers && <EventResponses message={message} onClose={() => setAnswers(false)} />}
      {editing && <EventEditor message={message} onSaved={() => { onChanged(); setEditing(false) }} onClose={() => setEditing(false)} />}
      {confirmCancel && <Sheet visible onClose={() => { if (!busy) setConfirmCancel(false) }}><Label large>Cancel event?</Label><Label>{event.title}</Label><Label>The event and existing responses remain in the conversation.</Label><Button title="Confirm cancel event" disabled={busy} onPress={() => void run(async () => { await updateEvent(message.id, { cancel: true }); if (alive.current) setConfirmCancel(false) })} /><Button title="Keep event" variant="secondary" disabled={busy} onPress={() => setConfirmCancel(false)} /></Sheet>}
    </>}
    {!!error && <Label>{error}</Label>}
  </View>
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
