import { beforeEach, expect, it, vi } from 'vitest'
import { answerEvent, createEvent, getShared, placeAt, searchPlaces, sendLocation, sendMessage, setDisappearing, updateEvent } from './api'
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('@/core/api/client', () => ({ api: mock }))
vi.mock('@/core/realtime/socket', () => ({ realtime: { on: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks(); Object.values(mock).forEach(fn => fn.mockResolvedValue({ data: {} })) })
it('binds a queued write to its account using the existing backend header', async () => {
  const signal = new AbortController().signal
  const payload = { client_id: 'stable-id', body: 'queued' }
  await sendMessage('chat', payload, signal, 'account-a')
  expect(mock.post).toHaveBeenCalledWith('/conversations/chat/messages/', payload, { timeout: 30000, signal, headers: { 'X-JM-Expected-User': 'account-a' } })
})
it('uses sequence pagination for shared items, including a zero boundary', async () => {
  await getShared('chat', 'docs', 0)
  expect(mock.get).toHaveBeenCalledWith('/conversations/chat/shared/', { params: { type: 'docs', before: 0 } })
})
it('uses the existing event response put/delete and disappearing contracts', async () => {
  await answerEvent('message', 'going'); await answerEvent('message', null); await setDisappearing('chat', 86400)
  expect(mock.put).toHaveBeenCalledWith('/messages/message/event-response/', { answer: 'going' })
  expect(mock.delete).toHaveBeenCalledWith('/messages/message/event-response/')
  expect(mock.put).toHaveBeenCalledWith('/conversations/chat/disappearing/', { seconds: 86400 })
})
it('sends locations with stable client IDs and keeps map requests on the backend', async () => {
  const position = { client_id: 'stable-location', latitude: 28.6, longitude: 77.2, accuracy: 20, name: 'Office', address: 'Street' }
  await sendLocation('chat', position)
  expect(mock.post).toHaveBeenCalledWith('/conversations/chat/locations/', position)
  const signal = new AbortController().signal
  await searchPlaces('office', position, signal); await placeAt(position.latitude, position.longitude)
  expect(mock.get).toHaveBeenCalledWith('/maps/search/', { params: { q: 'office', lat: 28.6, lng: 77.2 }, signal })
  expect(mock.get).toHaveBeenCalledWith('/maps/reverse/', { params: { lat: 28.6, lng: 77.2 } })
})
it('uses the current event create, edit and cancel endpoints unchanged', async () => {
  const value = { title: 'Meeting', starts_at: '2026-12-01T10:00:00Z', ends_at: null, place: '', description: '', link: '', reminder_minutes: 15 }
  await createEvent('chat', { ...value, client_id: 'stable-event' }); await updateEvent('message', value); await updateEvent('message', { cancel: true })
  expect(mock.post).toHaveBeenCalledWith('/conversations/chat/events/', { ...value, client_id: 'stable-event' })
  expect(mock.patch).toHaveBeenCalledWith('/messages/message/event/', value)
  expect(mock.patch).toHaveBeenCalledWith('/messages/message/event/', { cancel: true })
})
