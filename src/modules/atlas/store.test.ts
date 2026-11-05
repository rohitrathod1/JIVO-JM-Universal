import { describe, expect, it, vi } from 'vitest'
import { AtlasStore } from './store'
import type { AtlasStatus } from './model'

const on: AtlasStatus = { enabled: true, allowed: true, message: null }

describe('AtlasStore', () => {
  it('fetches the status once per TTL and normalises it', async () => {
    let now = 0
    const fetch = vi.fn(async () => ({ enabled: true, allowed: false, message: '  Ask HR to add your employee code.  ' }))
    const store = new AtlasStore(fetch, () => now, 60_000)
    await store.refreshStatus('u1')
    expect(store.statusEntry().value).toEqual({ enabled: true, allowed: false, message: 'Ask HR to add your employee code.' })
    await store.refreshStatus('u1')
    expect(fetch).toHaveBeenCalledTimes(1)
    now = 61_000
    await store.refreshStatus('u1')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('a failed status keeps the last value and marks failed (button stays hidden when unknown)', async () => {
    const fetch = vi.fn<() => Promise<AtlasStatus>>().mockRejectedValue(new Error('404'))
    const store = new AtlasStore(fetch)
    await store.refreshStatus('u1')
    expect(store.statusEntry()).toMatchObject({ value: null, failed: true, loading: false })
  })

  it('drops the cached thread and status when the account changes or signs out', async () => {
    const store = new AtlasStore(async () => on)
    await store.refreshStatus('u1')
    store.saveThread('u1', { asks: [], hasMore: true })
    expect(store.readThread('u1')).toEqual({ asks: [], hasMore: true })
    expect(store.readThread('u2')).toBeNull()
    store.bind('u2')
    expect(store.readThread('u1')).toBeNull()
    expect(store.statusEntry().value).toBeNull()
    store.saveThread('u1', { asks: [], hasMore: false })
    expect(store.readThread('u1')).toBeNull()
    store.clear()
    expect(store.readThread('u2')).toBeNull()
  })

  it('ignores a status that arrives after the account changed', async () => {
    let resolve!: (value: AtlasStatus) => void
    const store = new AtlasStore(() => new Promise(r => { resolve = r }))
    const pending = store.refreshStatus('u1')
    store.bind('u2')
    resolve(on); await pending
    expect(store.statusEntry().value).toBeNull()
  })
})
