import { describe, it, expect, vi } from 'vitest'
import { clearClipboardIfUnchanged, type ClearDeps } from './clipboardClear'
const deps = (initial: string | undefined, access = true) => { let clip = initial; let listener: (() => void) | null = null; const d: ClearDeps & { get: () => string | undefined; focus: () => void } = { read: async () => clip, write: vi.fn(async (t: string) => { clip = t }), canAccess: () => access, onAccess: fn => { listener = fn; return () => { listener = null } }, get: () => clip, focus: () => { access = true; listener?.() } }; return d }
describe('clipboard auto-clear', () => {
  it('clears when the clipboard still holds the copied secret', async () => { const d = deps('synthetic'); await clearClipboardIfUnchanged(d, 'synthetic'); expect(d.get()).toBe('') })
  it('leaves text copied later by the user or another app', async () => { const d = deps('other app'); await clearClipboardIfUnchanged(d, 'synthetic'); expect(d.write).not.toHaveBeenCalled(); expect(d.get()).toBe('other app') })
  it('clears unconditionally when reading would prompt (reference behaviour)', async () => { const d = deps(undefined); await clearClipboardIfUnchanged(d, 'synthetic'); expect(d.write).toHaveBeenCalledWith('') })
  it('treats a read failure like an unreadable clipboard', async () => { const d = deps('synthetic'); d.read = async () => { throw Error('denied') }; await clearClipboardIfUnchanged(d, 'synthetic'); expect(d.write).toHaveBeenCalledWith('') })
  it('waits for focus or foreground before touching the clipboard', async () => { const d = deps('synthetic', false); const p = clearClipboardIfUnchanged(d, 'synthetic'); await Promise.resolve(); expect(d.write).not.toHaveBeenCalled(); d.focus(); await p; expect(d.get()).toBe('') })
})
