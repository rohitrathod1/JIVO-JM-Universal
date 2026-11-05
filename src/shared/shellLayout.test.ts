import { describe, expect, it } from 'vitest'
import { chatListWidth, controlHeight, isActiveLink, isActiveShellLink, isWide, pagePadding, shellLinks } from './shellLayout'

describe('reference shell layout', () => {
  it('switches to the rail at the md breakpoint', () => {
    expect([390, 767, 768, 1440].map(isWide)).toEqual([false, false, true, true])
  })
  it('uses the 16px phone gutter and 32px desktop padding', () => {
    expect(pagePadding(390)).toEqual({ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 })
    expect(pagePadding(768).paddingHorizontal).toBe(32)
    expect(pagePadding(1440)).toEqual({ paddingHorizontal: 32, paddingTop: 32, paddingBottom: 40 })
  })
  it('keeps 40px controls on web and 44pt touch targets on native', () => {
    expect([controlHeight('web'), controlHeight('ios'), controlHeight('android')]).toEqual([40, 44, 44])
  })
  it('orders rail and phone tabs like the reference and hides unauthorized pages', () => {
    const all = shellLinks(['JM_ACCESS', 'JP_ACCESS', 'ADMIN_USERS', 'ADMIN_AUDIT'])
    expect(all.rail.map(l => l.title)).toEqual(['Home', 'Messenger', 'Notifications', 'Passwords', 'Tools', 'Approvals', 'People', 'Permission groups', 'Security', 'Software tools'])
    expect(all.tabs.map(l => l.tabTitle)).toEqual(['Home', 'Tools', 'Chats', 'Passwords', 'Profile'])
    expect(all.account.map(l => l.href)).toEqual(['/profile', '/alerts', '/tools', '/approvals', '/admin'])
    expect(all.tools).toBe('/notifications')
    // Reference BottomNav: without Passwords the JM Alerts list takes that slot.
    expect(shellLinks(['JM_ACCESS']).tabs.map(l => l.tabTitle)).toEqual(['Home', 'Alerts', 'Chats', 'Tools', 'Profile'])
    expect(shellLinks(['ADMIN_USERS']).rail.map(l => l.href)).toEqual(['/home', '/approvals', '/admin?tab=people', '/admin?tab=groups', '/admin?tab=security', '/admin?tab=tools'])
    expect(shellLinks(['ADMIN_AUDIT']).rail.map(l => l.title)).toEqual(['Home', 'Permission groups'])
    expect(shellLinks(['ADMIN_AUDIT']).tools).toBe('/admin?tab=groups')
    expect(shellLinks([]).tabs.map(l => l.href)).toEqual(['/home', '/profile'])
    expect(shellLinks([], true).rail).toHaveLength(10)
  })
  it('lights the link for the current view of a page', () => {
    const { rail, tabs } = shellLinks(['JM_ACCESS', 'ADMIN_USERS'])
    const lit = (pathname: string, params: Record<string, string>) => [...rail, ...tabs].filter(l => isActiveShellLink(pathname, params, l)).map(l => l.title)
    expect(lit('/admin', {})).toEqual(['People'])
    expect(lit('/admin', { tab: 'groups' })).toEqual(['Permission groups'])
    expect(lit('/alerts', {})).toEqual(['Alerts'])
    expect(lit('/notifications', {})).toEqual(['Notifications'])
    expect(shellLinks(['ADMIN_AUDIT']).rail.filter(l => isActiveShellLink('/admin', {}, l)).map(l => l.title)).toEqual(['Permission groups'])
  })
  it('uses the reference chats column widths', () => {
    expect([768, 1023, 1024, 1440].map(chatListWidth)).toEqual([360, 360, 400, 400])
  })
  it('matches a link and its sub-routes only', () => {
    expect(isActiveLink('/messenger/abc', '/messenger')).toBe(true)
    expect(isActiveLink('/messengers', '/messenger')).toBe(false)
    expect(isActiveLink('/home', '/home')).toBe(true)
  })
})
