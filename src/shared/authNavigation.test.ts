import { expect, it } from 'vitest'
import { greeting, landingRoute, safeNext } from './authNavigation'

it('lands messenger users in Chats and everyone else on Home', () => {
  expect(landingRoute(['JM_ACCESS'])).toBe('/messenger')
  expect(landingRoute(['JP_ACCESS', 'ADMIN_USERS'])).toBe('/home')
  expect(landingRoute([])).toBe('/home')
})
it.each(['/messenger/chat?seq=19', '/passwords?view=break-glass', '/home', '/profile#security', '/share?url=https%3A%2F%2Fexample.com&text=hello%20team'])('preserves an internal destination: %s', next => {
  expect(safeNext(next)).toBe(next)
})
it.each([undefined, null, ['//evil.example'], 3, 'https://evil.example', '//evil.example', '/\\evil.example', '/%2fevil.example', '/%252fevil.example', '/%5cevil.example', '/a/..//evil.example', '/%00evil', '/%0aevil', '/bad%xx', ' /messenger', '/login', '/approvals', '/%61pprovals', '/not-an-app-route'])('rejects unsafe or looping destinations: %s', next => {
  expect(safeNext(next)).toBe('/')
})
it('uses device-local greeting boundaries', () => {
  expect(greeting(new Date(2026, 10, 2, 11, 59))).toBe('Good morning')
  expect(greeting(new Date(2026, 10, 2, 12))).toBe('Good afternoon')
  expect(greeting(new Date(2026, 10, 2, 17))).toBe('Good evening')
})
