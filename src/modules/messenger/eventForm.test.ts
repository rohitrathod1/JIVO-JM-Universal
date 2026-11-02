import { describe, expect, it } from 'vitest'
import { eventInput, initialEventForm, parseLocal, type EventForm } from './eventForm'
const form = (): EventForm => ({ ...initialEventForm(undefined, new Date('2026-12-01T09:30:00').getTime()), title: 'Plant visit' })
describe('event form contract', () => {
  it('starts new events at the next full local hour with the reference reminder', () => {
    const value = eventInput(form()).value!
    expect(new Date(value.starts_at).getHours()).toBe(10); expect(new Date(value.starts_at).getMinutes()).toBe(0)
    expect(value.ends_at).toBeNull(); expect(value.reminder_minutes).toBe(15)
  })
  it('rejects malformed calendar dates and DST-normalized/nonexistent local times', () => {
    for (const [date, time] of [['2026-02-30', '10:00'], ['2026-12-01', '25:00'], ['bad', '10:00'], ['2026-12-01', '10:70']]) expect(parseLocal(date, time)).toBeNull()
    expect(parseLocal('2028-02-29', '23:59')).not.toBeNull()
  })
  it('allows the backend equal-end boundary and later-day endings, rejecting earlier times', () => {
    expect(eventInput({ ...form(), hasEnd: true, end: '10:00' }).value).not.toBeNull()
    expect(eventInput({ ...form(), hasEnd: true, end: '09:59' }).value).toBeNull()
    expect(eventInput({ ...form(), hasEnd: true, endDate: '2026-12-03', end: '02:00' }).value?.ends_at).toBe(new Date('2026-12-03T02:00:00').toISOString())
  })
  it('rejects script links, unsupported reminders, empty names and invalid coordinates', () => {
    for (const patch of [{ title: ' ' }, { link: 'javascript:alert(1)' }, { reminder: '31' }, { point: { latitude: NaN, longitude: 77 } }, { title: 'x'.repeat(121) }]) expect(eventInput({ ...form(), ...patch }).value).toBeNull()
  })
  it('preserves map points, optional reminder and meeting link in the exact payload', () => {
    expect(eventInput({ ...form(), point: { latitude: 28.6, longitude: 77.2 }, place: ' Office ', link: ' https://meet.example/test ', reminder: '' }).value).toMatchObject({ title: 'Plant visit', place: 'Office', place_latitude: 28.6, place_longitude: 77.2, link: 'https://meet.example/test', reminder_minutes: null })
  })
})
