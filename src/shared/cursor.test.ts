import { describe, expect, it, vi } from 'vitest'
import { CursorController } from './cursor'
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
describe('cursor ownership', () => {
  it('discards a previous query page when filters change', async () => {
    const old = deferred<{ results: { id: string }[]; next_cursor: string | null }>()
    const c = new CursorController<{ id: string }>(String)
    await c.reset(async cursor => cursor ? old.promise : { results: [{ id: 'old' }], next_cursor: 'next' })
    const pending = c.more()
    await c.reset(async () => ({ results: [{ id: 'new' }], next_cursor: null }))
    old.resolve({ results: [{ id: 'stale' }], next_cursor: 'stale' }); await pending
    expect(c.snapshot().items).toEqual([{ id: 'new' }]); expect(c.snapshot().cursor).toBeNull()
  })
  it('guards concurrent page loads and merges overlapping IDs', async () => {
    const page = deferred<{ results: { id: string; value: number }[]; next_cursor: string | null }>()
    const load = vi.fn(async (cursor?: string | null) => cursor ? page.promise : { results: [{ id: 'a', value: 1 }], next_cursor: 'next' })
    const c = new CursorController<{ id: string; value: number }>(String); await c.reset(load)
    const first = c.more(); await c.more(); expect(load).toHaveBeenCalledTimes(2)
    page.resolve({ results: [{ id: 'a', value: 2 }, { id: 'b', value: 3 }], next_cursor: null }); await first
    expect(c.snapshot().items).toEqual([{ id: 'a', value: 2 }, { id: 'b', value: 3 }])
  })
})
