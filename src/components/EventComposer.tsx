import { useEffect, useRef, useState } from 'react'
import { Switch, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { createEvent, updateEvent, type EventData, type EventInput, type Message } from '../modules/messenger/api'
import { eventInput, initialEventForm } from '../modules/messenger/eventForm'
import { REMINDERS } from '../modules/messenger/lib/events'
import { eventPlaceText } from '../modules/messenger/location/format'
import { errorMessage } from '../core/api/client'
import { Button, Field, Label } from '../ui'
import { Sheet } from './Sheet'
import { EventDateTime } from './EventDateTime'
import { LocationPicker } from './LocationPicker'

function EventForm({ event, onSubmit, onClose }: { event?: EventData | null; onSubmit: (value: EventInput) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(() => initialEventForm(event)); const [picking, setPicking] = useState(false); const [reminders, setReminders] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const result = eventInput(form)
  async function submit() {
    if (busy || !result.value) return
    setBusy(true); setError('')
    try { await onSubmit(result.value); if (alive.current) onClose() }
    catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  if (picking) return <LocationPicker mode="pick" onClose={() => setPicking(false)} onSend={place => setForm(value => ({ ...value, place: eventPlaceText(place), point: { latitude: place.latitude, longitude: place.longitude } }))} />
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>{event ? 'Edit event' : 'Create event'}</Label>
    <Field label="Event name" value={form.title} onChangeText={title => setForm(value => ({ ...value, title }))} maxLength={120} editable={!busy} />
    <Field label="Description (optional)" value={form.description} onChangeText={description => setForm(value => ({ ...value, description }))} maxLength={1000} multiline editable={!busy} />
    <View style={{ flexDirection: 'row', gap: 8 }}><EventDateTime label="Start date" type="date" value={form.date} disabled={busy} onChange={date => setForm(value => ({ ...value, date }))} /><EventDateTime label="Start time" type="time" value={form.start} disabled={busy} onChange={start => setForm(value => ({ ...value, start }))} /></View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label>End date and time</Label><Switch accessibilityLabel="End date and time" value={form.hasEnd} disabled={busy} onValueChange={hasEnd => setForm(value => ({ ...value, hasEnd, endDate: value.endDate || value.date }))} /></View>
    {form.hasEnd && <View style={{ flexDirection: 'row', gap: 8 }}><EventDateTime label="End date" type="date" value={form.endDate} min={form.date} disabled={busy} onChange={endDate => setForm(value => ({ ...value, endDate }))} /><EventDateTime label="End time" type="time" value={form.end} disabled={busy} onChange={end => setForm(value => ({ ...value, end }))} /></View>}
    <Field label="Location (optional)" value={form.place} onChangeText={place => setForm(value => ({ ...value, place, point: null }))} maxLength={200} editable={!busy} />
    <Button title={form.point ? 'Change place on the map' : 'Choose on the map'} variant="ghost" disabled={busy} onPress={() => setPicking(true)} />
    <Field label="Meeting link (optional)" value={form.link} onChangeText={link => setForm(value => ({ ...value, link }))} maxLength={500} keyboardType="url" autoCapitalize="none" editable={!busy} />
    <Label>Reminder</Label><Button title={REMINDERS.find(item => item.value === form.reminder)?.label ?? 'No reminder'} accessibilityLabel="Reminder" variant="secondary" disabled={busy} onPress={() => setReminders(value => !value)} />
    {reminders && REMINDERS.map(item => <Button key={item.value} title={item.label} variant={form.reminder === item.value ? 'primary' : 'secondary'} disabled={busy} onPress={() => { setForm(value => ({ ...value, reminder: item.value })); setReminders(false) }} />)}
    {form.reminder !== '' && <Label>A notification to you and everyone going.</Label>}
    {!!form.title.trim() && !!result.error && <Label>{result.error}</Label>}{!!error && <Label>{error}</Label>}
    <Button title={event ? 'Save event' : 'Send event'} disabled={busy || !result.value} onPress={() => void submit()} /><Button title="Close event" variant="ghost" disabled={busy} onPress={onClose} />
  </Sheet>
}
export function EventComposer({ conversation, onSent, onClose }: { conversation: string; onSent: (message: Message) => void; onClose: () => void }) {
  const request = useRef({ key: '', id: randomUUID() })
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  return <EventForm onClose={onClose} onSubmit={async value => {
    const key = JSON.stringify(value)
    if (request.current.key !== key) request.current = { key, id: randomUUID() }
    const message = await createEvent(conversation, { ...value, client_id: request.current.id })
    if (active.current) onSent(message)
  }} />
}
export function EventEditor({ message, onSaved, onClose }: { message: Message; onSaved: (message: Message) => void; onClose: () => void }) {
  if (!message.can.edit_event || !message.event || message.deleted) return null
  return <EventForm event={message.event} onClose={onClose} onSubmit={async value => { onSaved(await updateEvent(message.id, value)) }} />
}
