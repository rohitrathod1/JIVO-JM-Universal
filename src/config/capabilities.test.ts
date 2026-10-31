import { describe, expect, it } from 'vitest'

import { allows } from './capabilities'

describe('capability rules', () => {
  const held = ['JM_ACCESS', 'ADMIN_AUDIT']
  it('single capability', () => {
    expect(allows(held, 'JM_ACCESS')).toBe(true)
    expect(allows(held, 'JP_ACCESS')).toBe(false)
  })
  it('any of a list', () => {
    expect(allows(held, ['ADMIN_USERS', 'ADMIN_AUDIT'])).toBe(true)
    expect(allows(held, ['ADMIN_USERS', 'JP_ACCESS'])).toBe(false)
  })
  it('no rule means anyone signed in', () => {
    expect(allows([], undefined)).toBe(true)
  })
})
