import { expect, it } from 'vitest'
import { focusedPushTarget, notificationPath, pushNotification } from './pushPolicy'

it('converts backend chat paths to safe Universal routes and keeps the conversion idempotent', () => {
  const link = notificationPath('/messenger/chat-1?seq=42&token=secret')
  expect(link).toBe('/messenger?conversation=chat-1&seq=42'); expect(notificationPath(link)).toBe(link)
})
it.each(['https://evil.example', '//evil.example', '/\\evil', '/messenger/%2fsecret', '/approvals', '/unknown', null, { url: '/messenger' }])('uses the landing page for unsafe or unsupported push target %s', link => expect(notificationPath(link)).toBe('/'))
it('keeps vault and alerts deep links through repeated validation without accepting arbitrary parameters', () => {
  const vault = notificationPath('/passwords/vaults/vault-1/activity'); expect(notificationPath(vault)).toBe(vault)
  expect(notificationPath(notificationPath('/admin/alerts'))).toBe('/notifications?view=alerts')
  expect(notificationPath(notificationPath('/admin/users/person-1'))).toBe('/admin?tab=people&user=person-1')
  expect(notificationPath('/messenger?conversation=//evil&seq=999999999999999999&token=secret')).toBe('/messenger')
})
it('suppresses a message only for that same focused conversation, never the list or another origin', () => {
  expect(focusedPushTarget('https://jm.test/messenger?conversation=a', '/messenger?conversation=a&seq=9', 'https://jm.test')).toBe(true)
  expect(focusedPushTarget('https://jm.test/messenger?conversation=b', '/messenger?conversation=a', 'https://jm.test')).toBe(false)
  expect(focusedPushTarget('https://evil.test/messenger?conversation=a', '/messenger?conversation=a', 'https://jm.test')).toBe(false)
  expect(focusedPushTarget('https://jm.test/messenger', '/messenger', 'https://jm.test')).toBe(false)
})
it('bounds notification content and ignores unsafe icons and malformed option values', () => {
  const value = pushNotification({ title: 'x'.repeat(1000), body: 'y'.repeat(4000), url: '//evil', icon: 'https://evil/pixel', tag: 'tag', renotify: true, silent: 'false', vibrate: [-1, 'x', NaN, 30000, 10.5], requireInteraction: 'yes' })
  expect(value.title.length).toBe(200); expect(value.options.body?.length).toBe(2000)
  expect(value.options).toMatchObject({ icon: '/icons/icon-192.png', data: { url: '/' }, vibrate: [10000, 10], silent: false, renotify: true, requireInteraction: false })
})
it('honors silent notifications and uses a safe generic payload on invalid data', () => {
  expect(pushNotification({ silent: true, vibrate: [200], renotify: true }).options.vibrate).toBeUndefined()
  expect(pushNotification(null)).toMatchObject({ title: 'JIVO JM', options: { body: '', renotify: false, data: { url: '/' } } })
})
