import { expect, it, vi } from 'vitest'
import { NativeAppLock } from './nativeAppLock'
function fixture(enabled = true) {
 const deps = { read: vi.fn(async () => enabled), write: vi.fn(async () => {}), authenticate: vi.fn(async () => true), cancel: vi.fn() }
 return { model: new NativeAppLock(deps), deps }
}
it('restores locked, unlocks after device verification, and locks on background', async () => {
 const { model } = fixture(); await model.restore(); expect(model.snapshot().locked).toBe(true)
 await model.verify(); expect(model.snapshot().locked).toBe(false)
 model.background(); expect(model.snapshot().locked).toBe(true)
})
it('does not unlock after a pending OS prompt completes in the background', async () => {
 const { model, deps } = fixture(); await model.restore()
 let finish!: (value: boolean) => void
 deps.authenticate.mockImplementation(() => new Promise(resolve => { finish = resolve }))
 const pending = model.verify(); model.background(); finish(true); await pending
 expect(model.snapshot().locked).toBe(true)
})
it('fails closed on storage error and never enables after cancellation', async () => {
 const { model, deps } = fixture(false); deps.read.mockRejectedValueOnce(Error('locked storage'))
 await model.restore(); expect(model.snapshot().ready).toBe(false)
 await model.restore(); deps.authenticate.mockResolvedValueOnce(false); await model.verify(true)
 expect(deps.write).not.toHaveBeenCalled(); expect(model.snapshot().enabled).toBe(false)
})
it('restores after effect reattachment and ignores the detached restore', async () => {
 const { model, deps } = fixture()
 let finish!: (value: boolean) => void
 deps.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
 const stale = model.restore(); model.dispose(); await model.restore(); finish(false); await stale
 expect(model.snapshot()).toMatchObject({ ready: true, enabled: true, locked: true })
 await model.verify(); expect(model.snapshot().locked).toBe(false)
})
it('finishes initial restoration locked if the app backgrounds during the read', async () => {
 const { model, deps } = fixture(); let finish!: (value: boolean) => void
 deps.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
 const pending = model.restore(); model.background(); finish(true); await pending
 expect(model.snapshot()).toMatchObject({ ready: true, enabled: true, locked: true })
})
