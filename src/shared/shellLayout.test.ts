import { describe, expect, it } from 'vitest'
import { controlHeight, isActiveLink, isWide, pagePadding, shellLinks } from './shellLayout'

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
    const all = shellLinks(['JM_ACCESS', 'JP_ACCESS', 'ADMIN_AUDIT'])
    expect(all.rail.map(l => l.title)).toEqual(['Home', 'Messenger', 'Activity', 'Passwords', 'Profile', 'Admin'])
    expect(all.tabs.map(l => l.tabTitle)).toEqual(['Home', 'Activity', 'Chats', 'Passwords', 'Profile', 'Admin'])
    expect(shellLinks([]).tabs.map(l => l.href)).toEqual(['/home', '/notifications', '/profile'])
    expect(shellLinks([], true).rail).toHaveLength(6)
  })
  it('matches a link and its sub-routes only', () => {
    expect(isActiveLink('/messenger/abc', '/messenger')).toBe(true)
    expect(isActiveLink('/messengers', '/messenger')).toBe(false)
    expect(isActiveLink('/home', '/home')).toBe(true)
  })
})
