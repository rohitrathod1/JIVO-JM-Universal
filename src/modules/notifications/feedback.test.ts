import { expect, it } from 'vitest'
import { FeedbackGate, quietHours } from './feedback'
it('deduplicates new events and limits notification bursts', () => {
 const gate = new FeedbackGate()
 expect(gate.accept('a', 0)).toBe(true); expect(gate.accept('a', 2000)).toBe(false)
 expect(gate.accept('b', 500)).toBe(false); expect(gate.accept('c', 2000)).toBe(true)
})
it('honors overnight office-time quiet hours', () => {
 const prefs = { dnd_start: '22:00', dnd_end: '07:00' }
 expect(quietHours(prefs, new Date('2026-11-02T18:00:00Z'))).toBe(true)
 expect(quietHours(prefs, new Date('2026-11-02T07:00:00Z'))).toBe(false)
})
