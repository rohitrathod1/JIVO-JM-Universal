import type { Message } from '../api'

/** Event helpers: how an event's time reads, and the calendar file for "Add to calendar". */

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const time = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
const day = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export function eventWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt)
  if (!endsAt) return `${day(start)} · ${time(start)}`
  const end = new Date(endsAt)
  return sameDay(start, end) ? `${day(start)} · ${time(start)} – ${time(end)}` : `${day(start)}, ${time(start)} – ${day(end)}, ${time(end)}`
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\r\n|\r|\n/g, '\\n')
function foldLine(line: string): string[] {
  const lines: string[] = []; let part = ''; let bytes = 0
  for (const character of line) {
    const point = character.codePointAt(0)!
    const size = point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4
    if (bytes + size > 75) { lines.push(part); part = ' '; bytes = 1 }
    part += character; bytes += size
  }
  lines.push(part); return lines
}

/** An .ics file for the device's calendar (Google, Outlook, Apple), like WhatsApp's "Add to calendar". */
export function icsFor(id: string, e: NonNullable<Message['event']>): string {
  const end = e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 3_600_000).toISOString()
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JIVO//JM//EN',
    'BEGIN:VEVENT',
    `UID:${id.replace(/[\r\n]/g, '')}@jm.jivo.in`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(e.starts_at)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.place ? [`LOCATION:${icsText(e.place)}`] : []),
    ...(e.description || e.link ? [`DESCRIPTION:${icsText([e.description, e.link].filter(Boolean).join('\n'))}`] : []),
    ...(e.link && isMeetingLink(e.link) ? [`URL:${e.link}`] : []),
    ...(e.cancelled ? ['STATUS:CANCELLED'] : []),
    ...(e.reminder_minutes !== null && e.reminder_minutes !== undefined && !e.cancelled
      ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, `TRIGGER:-PT${e.reminder_minutes}M`, 'END:VALARM']
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].flatMap(foldLine).join('\r\n') + '\r\n'
}

/** The reminder choices (minutes before the start), as the server accepts them. */
export const REMINDERS: { value: string; label: string }[] = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'When it starts' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
]

export function reminderLabel(minutes: number | null | undefined): string {
  return REMINDERS.find((r) => r.value === (minutes === null || minutes === undefined ? '' : String(minutes)))?.label ?? ''
}

/** A meeting link people can open: http(s) only. */
export function isMeetingLink(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname) && !/\s/.test(value.trim())
  } catch {
    return false
  }
}
