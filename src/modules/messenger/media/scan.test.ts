import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { awaitScan } from './scan'
import { uploadLimitError } from './model'
import type { Attachment } from '../api'
const upload = { id: 'upload', status: 'processing' } as Attachment
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
describe('upload scanner boundary', () => {
  it('does not release a processing file until the server marks it ready', async () => {
    const read = vi.fn(async () => ({ ...upload, status: 'ready' as const }))
    const off = vi.fn(); const done = vi.fn()
    const promise = awaitScan(upload, { read, subscribe: () => off }, new AbortController().signal).then(done)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000); await promise
    expect(done.mock.calls[0][0].status).toBe('ready'); expect(off).toHaveBeenCalledOnce()
  })
  it('rejects scanned rejections', async () => {
    const promise = awaitScan({ ...upload, status: 'rejected' }, { read: vi.fn(), subscribe: vi.fn() }, new AbortController().signal)
    await expect(promise).rejects.toThrow('server rejected')
  })
  it('cleans subscriptions and polling on cancellation', async () => {
    const abort = new AbortController(); const read = vi.fn(); const off = vi.fn()
    const promise = awaitScan(upload, { read, subscribe: () => off }, abort.signal)
    const assertion = expect(promise).rejects.toThrow('cancelled'); abort.abort(); await assertion
    await vi.advanceTimersByTimeAsync(200000); expect(off).toHaveBeenCalledOnce(); expect(read).not.toHaveBeenCalled()
  })
  it('bounds the wait even if the scan never finishes', async () => {
    const promise = awaitScan(upload, { read: vi.fn(async () => upload), subscribe: () => () => {} }, new AbortController().signal, 5000)
    const assertion = expect(promise).rejects.toMatchObject({ retryable: true })
    await vi.advanceTimersByTimeAsync(5000); await assertion
  })
  it('preserves existing file size limits', () => {
    expect(uploadLimitError({ name: 'photo.jpg', size: 10 * 1024 * 1024 + 1 })).toContain('10 MB')
    expect(uploadLimitError({ name: 'movie.mp4', size: 500 * 1024 * 1024 + 1 })).toContain('500 MB')
    expect(uploadLimitError({ name: 'document.txt', size: 1 })).toBeNull()
  })
})
