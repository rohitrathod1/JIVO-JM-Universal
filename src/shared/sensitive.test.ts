import { expect, it, vi } from 'vitest'
import { SensitiveRequestGuard } from './sensitive'
import { subscribeSensitiveView } from './sensitiveLifecycle.web'
it('discards a delayed secret after background and refocus, while allowing a new request', async () => {
  const guard = new SensitiveRequestGuard(); let resolve!: (value: string[]) => void
  const token = guard.begin(); const deferred = new Promise<string[]>(r => { resolve = r }); let shown: string[] = []
  const pending = deferred.then(value => { if (guard.accepts(token)) shown = value })
  guard.setActive(false); guard.setActive(true); resolve(['secret']); await pending; expect(shown).toEqual([])
  expect(guard.accepts(guard.begin())).toBe(true)
  const closed = guard.begin(); guard.clear(); expect(guard.accepts(closed)).toBe(false)
})
it('clears sensitive views on window blur without a visibility change and removes listeners', () => {
  const win = new EventTarget(); const doc = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true })
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc)
  try { const states: boolean[] = []; const off = subscribeSensitiveView(active => states.push(active)); win.dispatchEvent(new Event('blur')); expect(states).toEqual([true, false]); win.dispatchEvent(new Event('focus')); expect(states.at(-1)).toBe(true); off(); win.dispatchEvent(new Event('blur')); expect(states).toHaveLength(3) } finally { vi.unstubAllGlobals() }
})

it('rejects a request started while inactive even if focus returns before its response', () => { const guard = new SensitiveRequestGuard(); guard.setActive(false); const token = guard.begin(); guard.setActive(true); expect(guard.accepts(token)).toBe(false) })
