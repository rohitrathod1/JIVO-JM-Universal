import { describe, it, expect, vi } from 'vitest'
import { ScreenCaptureGuard } from './screenCaptureGuard'
const setup = () => { const calls: string[] = []; const dep = (name: string) => vi.fn(async () => { calls.push(name) }); const g = new ScreenCaptureGuard({ prevent: dep('prevent'), allow: dep('allow'), protectSwitcher: dep('protect'), unprotectSwitcher: dep('unprotect') }); return { g, calls } }
describe('screen capture guard', () => {
  it('prevents capture and protects the switcher while a secret is shown, then restores both', async () => {
    const { g, calls } = setup(); const release = g.acquire('capture'); await g.settled(); expect(calls).toEqual(['prevent', 'protect'])
    release(); await g.settled(); expect(calls).toEqual(['prevent', 'protect', 'allow', 'unprotect'])
  })
  it('keeps capture blocked until the last holder releases and ignores double release', async () => {
    const { g, calls } = setup(); const a = g.acquire('capture'), b = g.acquire('capture'); a(); a(); await g.settled(); expect(calls).toEqual(['prevent', 'protect'])
    b(); await g.settled(); expect(calls.slice(-2)).toEqual(['allow', 'unprotect'])
  })
  it('switcher-only holders never block screenshots and survive a capture release', async () => {
    const { g, calls } = setup(); const s = g.acquire('switcher'); const c = g.acquire('capture'); c(); await g.settled(); expect(calls).toEqual(['protect'])
    s(); await g.settled(); expect(calls).toEqual(['protect', 'unprotect'])
  })
  it('collapses a fast reveal/hide into the final state and tolerates unsupported devices', async () => {
    const prevent = vi.fn(async () => { throw Error('unavailable') }), allow = vi.fn(async () => {}); const g = new ScreenCaptureGuard({ prevent, allow, protectSwitcher: async () => {}, unprotectSwitcher: async () => {} })
    g.acquire('capture')(); await g.settled(); expect(prevent).not.toHaveBeenCalled(); expect(allow).not.toHaveBeenCalled()
    const r = g.acquire('capture'); await g.settled(); expect(prevent).toHaveBeenCalledOnce(); r(); await g.settled(); expect(allow).not.toHaveBeenCalled()
  })
})
