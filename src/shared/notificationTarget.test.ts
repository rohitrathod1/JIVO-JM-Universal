import { expect, it } from 'vitest'
import { notificationTarget } from './notificationTarget'
it('maps original internal links without forwarding arbitrary parameters', () => {
 expect(notificationTarget('/messenger/chat-id?seq=42&token=secret')).toEqual({ pathname: '/messenger', params: { conversation: 'chat-id', seq: '42' } })
 expect(notificationTarget('/passwords/vaults/vault-id/activity')).toEqual({ pathname: '/passwords', params: { vault: 'vault-id', view: 'activity' } })
 expect(notificationTarget('/passwords/entries/entry')).toEqual({ pathname: '/passwords', params: { entry: 'entry' } })
 expect(notificationTarget('/admin/users/user')).toEqual({ pathname: '/admin', params: { tab: 'people', user: 'user' } })
})
it.each(['https://evil.invalid', '//evil.invalid', '/passwords/../admin', '/messenger/%2fsecret', '/messenger/a/b', '/unknown', '/messenger/a\\b'])('rejects unsafe or unsupported link %s', link => expect(notificationTarget(link)).toBeNull())
