import type { EventData, EventInput } from './api'
import { isMeetingLink } from './lib/events'
import { validPoint, type LatLng } from './location/model'
export interface EventForm { title: string; description: string; date: string; start: string; hasEnd: boolean; endDate: string; end: string; place: string; point: LatLng | null; link: string; reminder: string }
const pad = (value: number) => String(value).padStart(2, '0')
export const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
export function parseLocal(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const value = new Date(`${date}T${time}:00`)
  return Number.isFinite(value.getTime()) && localDate(value) === date && localTime(value) === time ? value : null
}
export function initialEventForm(event?: EventData | null, now = Date.now()): EventForm {
  const start = event ? new Date(event.starts_at) : new Date(now + 3600000)
  if (!event) start.setMinutes(0, 0, 0)
  const end = event?.ends_at ? new Date(event.ends_at) : null
  return { title: event?.title ?? '', description: event?.description ?? '', date: localDate(start), start: localTime(start), hasEnd: !!end, endDate: localDate(end ?? start), end: end ? localTime(end) : '', place: event?.place ?? '', point: event?.place_point ?? null, link: event?.link ?? '', reminder: event ? event.reminder_minutes === null || event.reminder_minutes === undefined ? '' : String(event.reminder_minutes) : '15' }
}
export function eventInput(form: EventForm): { value: EventInput | null; error: string } {
  if (!form.title.trim()) return { value: null, error: 'Add an event name.' }
  if (form.title.trim().length > 120 || form.description.trim().length > 1000 || form.place.trim().length > 200 || form.link.trim().length > 500) return { value: null, error: 'Some event details are too long.' }
  const start = parseLocal(form.date, form.start); const end = form.hasEnd ? parseLocal(form.endDate, form.end) : null
  if (!start || form.hasEnd && !end) return { value: null, error: 'Choose a valid date and time.' }
  if (end && end < start) return { value: null, error: 'The end must be after the start.' }
  if (form.link.trim() && !isMeetingLink(form.link)) return { value: null, error: 'Paste a link that starts with https://' }
  if (!['', '0', '5', '15', '30', '60', '1440'].includes(form.reminder)) return { value: null, error: 'Choose a reminder from the list.' }
  if (form.point && !validPoint(form.point)) return { value: null, error: 'Choose a valid place on the map.' }
  return { error: '', value: { title: form.title.trim(), description: form.description.trim(), starts_at: start.toISOString(), ends_at: end?.toISOString() ?? null, place: form.place.trim(), place_latitude: form.point?.latitude ?? null, place_longitude: form.point?.longitude ?? null, link: form.link.trim(), reminder_minutes: form.reminder === '' ? null : Number(form.reminder) } }
}
