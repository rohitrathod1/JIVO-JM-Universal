import { expect, it } from 'vitest'
import type { EventData } from '../api'
import { icsFor, isMeetingLink } from './events'
const event: EventData = { title: 'Plant visit', starts_at: '2026-12-01T10:00:00+05:30', ends_at: null, place: 'Office', description: 'Review', link: 'https://meet.example/test', reminder_minutes: 15, counts: { going: 0, maybe: 0, not_going: 0 }, my_answer: null }
it('exports UTC calendar times, default one-hour duration, link and reminder', () => {
  const text = icsFor('id', event)
  expect(text).toContain('DTSTART:20261201T043000Z\r\n'); expect(text).toContain('DTEND:20261201T053000Z\r\n')
  expect(text).toContain('URL:https://meet.example/test\r\n'); expect(text).toContain('TRIGGER:-PT15M\r\n')
})
it('escapes line injection and folds unicode without splitting code points', () => {
  const text = icsFor('id\r\nATTENDEE:bad', { ...event, title: 'आ'.repeat(100), description: 'line\rATTENDEE:bad\ncomma,semi;slash\\' })
  expect(text.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true)
  expect(text).not.toContain('\r\nATTENDEE:')
  expect(text.replace(/\r\n /g, '')).toContain('SUMMARY:' + 'आ'.repeat(100))
  expect(text).toContain('line\\nATTENDEE:bad\\ncomma\\,semi\\;slash\\\\')
})
it('omits unsafe URLs and alarms from cancelled events', () => {
  const text = icsFor('id', { ...event, cancelled: true, link: 'https://example.test/\r\nATTENDEE:bad' })
  expect(text).toContain('STATUS:CANCELLED'); expect(text).not.toContain('BEGIN:VALARM'); expect(text).not.toContain('\r\nURL:')
  for (const value of ['javascript:alert(1)', '/relative', 'ftp://example.test', 'https://example.test/a b']) expect(isMeetingLink(value)).toBe(false)
})
