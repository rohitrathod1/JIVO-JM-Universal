import type { Preferences } from './api'
export function quietHours(preferences: Pick<Preferences, 'dnd_start' | 'dnd_end'>, now = new Date()) {
  if (!preferences.dnd_start || !preferences.dnd_end) return false
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
  const start = preferences.dnd_start.slice(0, 5); const end = preferences.dnd_end.slice(0, 5)
  return start === end ? false : start < end ? time >= start && time < end : time >= start || time < end
}
export class FeedbackGate {
  private seen = new Set<string>()
  private last = -Infinity
  accept(id: string, now = Date.now()) {
    if (this.seen.has(id)) return false
    this.seen.add(id)
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value!)
    if (now - this.last < 1500) return false
    this.last = now; return true
  }
}
