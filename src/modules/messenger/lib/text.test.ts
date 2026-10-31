import { describe, expect, it } from 'vitest'

import { imageBox, isNearBottom, preservedScrollTop } from './scroll'
import { dayLabel, firstEmoji, highlightParts, isMuted, lastSeenLabel, listTime, mentionToken, segments, typingLabel, withMentionTokens } from './text'

describe('message text', () => {
  it('turns only http(s) and mailto into links; never javascript:', () => {
    const parts = segments('see https://jivo.in/x?a=1. and javascript:alert(1) or mailto:it@jivo.in')
    expect(parts.filter((p) => p.type === 'link').map((p) => (p as { href: string }).href)).toEqual(['https://jivo.in/x?a=1', 'mailto:it@jivo.in'])
    expect(parts.map((p) => p.value).join('')).toBe('see https://jivo.in/x?a=1. and javascript:alert(1) or mailto:it@jivo.in')
  })

  it('highlights mentions of known names only', () => {
    const parts = segments('@Ravi Kumar please check, @nobody', ['Ravi Kumar'])
    expect(parts[0]).toEqual({ type: 'mention', value: '@Ravi Kumar' })
    expect(parts.filter((p) => p.type === 'mention')).toHaveLength(1)
  })

  it('composer mentions become server tokens', () => {
    const members = [
      { user: { id: 'u1', name: 'Ravi' }, is_me: false },
      { user: { id: 'u2', name: 'Ravi Kumar' }, is_me: false },
      { user: { id: 'me', name: 'Asha' }, is_me: true },
    ]
    expect(withMentionTokens('@Ravi Kumar and @Ravi, not @Asha', members)).toBe(
      `${mentionToken('Ravi Kumar', 'u2')} and ${mentionToken('Ravi', 'u1')}, not @Asha`,
    )
  })

  it('day labels and list times', () => {
    const now = new Date(2026, 9, 6, 12, 0)
    expect(dayLabel(new Date(2026, 9, 6, 8, 0).toISOString(), now)).toBe('Today')
    expect(dayLabel(new Date(2026, 9, 5, 23, 0).toISOString(), now)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 8, 1).toISOString(), now)).toBe('01-Sep-2026')
    expect(listTime(new Date(2026, 9, 6, 9, 5).toISOString(), now)).toBe('09:05')
    expect(listTime(new Date(2026, 7, 15).toISOString(), now)).toBe('15-Aug')
  })

  it('search highlights without HTML', () => {
    expect(highlightParts('the [[mustard]] oil <b>')).toEqual([
      { text: 'the ', hit: false },
      { text: 'mustard', hit: true },
      { text: ' oil <b>', hit: false },
    ])
  })

  it('mute state', () => {
    const now = new Date('2026-10-06T10:00:00Z')
    expect(isMuted(null, now)).toBe(false)
    expect(isMuted('9999-12-31T00:00:00Z', now)).toBe(true)
    expect(isMuted('2026-10-06T09:00:00Z', now)).toBe(false)
  })
})

describe('scroll anchoring', () => {
  it('keeps the reader on the same message when older ones are inserted above', () => {
    // Reading at scrollTop 40 in 2000px of content; 1500px of older messages arrive above.
    expect(preservedScrollTop(40, 2000, 3500)).toBe(1540)
    expect(preservedScrollTop(0, 2000, 2000)).toBe(0)
  })

  it('near-bottom detection and image boxes', () => {
    expect(isNearBottom({ scrollTop: 900, scrollHeight: 1500, clientHeight: 500 })).toBe(true)
    expect(isNearBottom({ scrollTop: 200, scrollHeight: 1500, clientHeight: 500 })).toBe(false)
    expect(imageBox(1200, 800)).toEqual({ width: 280, height: 187 })
    expect(imageBox(400, 1200)).toEqual({ width: 107, height: 320 })
    expect(imageBox(null, null)).toEqual({ width: 280, height: 210 })
  })
})

describe('presence and typing labels', () => {
  const now = new Date(2026, 9, 6, 15, 0)
  it('last seen', () => {
    expect(lastSeenLabel(new Date(2026, 9, 6, 14, 5).toISOString(), now)).toBe('last seen today at 14:05')
    expect(lastSeenLabel(new Date(2026, 9, 5, 9, 10).toISOString(), now)).toBe('last seen yesterday at 09:10')
    expect(lastSeenLabel(new Date(2026, 8, 3, 18, 0).toISOString(), now)).toBe('last seen 03-Sep at 18:00')
  })
  it('typing', () => {
    expect(typingLabel(['Ravi Kumar'], false)).toBe('typing…')
    expect(typingLabel(['Ravi Kumar'], true)).toBe('Ravi is typing…')
    expect(typingLabel(['Ravi Kumar', 'Meena Iyer'], true)).toBe('Ravi and Meena are typing…')
    expect(typingLabel(['A', 'B', 'C'], true)).toBe('3 people are typing…')
  })
})

describe('firstEmoji (reacting with any emoji from the keyboard)', () => {
  it('takes the first whole emoji, including flags, skin tones and joined emojis', () => {
    expect(firstEmoji('😀')).toBe('😀')
    expect(firstEmoji('ok 👍🏽 nice')).toBe('👍🏽')
    expect(firstEmoji('🇮🇳')).toBe('🇮🇳')
    expect(firstEmoji('👨‍👩‍👧')).toBe('👨‍👩‍👧')
    expect(firstEmoji('❤️')).toBe('❤️')
    expect(firstEmoji('hello')).toBeNull()
  })
})
