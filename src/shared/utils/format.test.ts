import { describe, expect, it } from 'vitest'

import { formatDate, formatRelative, initials } from './format'

describe('formatting', () => {
  it('dates as DD-MMM-YYYY', () => {
    expect(formatDate(new Date(2026, 9, 5))).toBe('05-Oct-2026')
    expect(formatDate(null)).toBe('—')
  })
  it('relative times', () => {
    const now = new Date(2026, 9, 5, 12, 0, 0)
    expect(formatRelative(new Date(2026, 9, 5, 11, 59, 30), now)).toBe('just now')
    expect(formatRelative(new Date(2026, 9, 5, 11, 48), now)).toBe('12 min ago')
    expect(formatRelative(new Date(2026, 9, 5, 9, 0), now)).toBe('3 h ago')
    expect(formatRelative(new Date(2026, 9, 1), now)).toBe('01-Oct-2026')
  })
  it('initials', () => {
    expect(initials('Asha Verma')).toBe('AV')
    expect(initials('Ravi')).toBe('R')
    expect(initials('  ')).toBe('?')
  })
})
