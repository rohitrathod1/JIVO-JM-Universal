import { describe, expect, it } from 'vitest'
import type { SharedItem } from './api'
import { mergeShared, safeSharedLink } from './sharedMedia'
const item = (seq: number, url: string): SharedItem => ({ message: { id: `m${seq}`, seq, sender: null, created_at: '' }, url })
describe('shared media cursors and safe links', () => {
  it('keeps distinct links in one message and removes overlapping page entries', () => {
    expect(mergeShared([item(4, 'https://a.test')], [item(4, 'https://a.test'), item(4, 'https://b.test'), item(3, 'https://c.test')])).toHaveLength(3)
  })
  it('orders newest first and replaces stale server entries', () => {
    const replacement = { ...item(2, 'https://a.test'), text: 'updated' }
    expect(mergeShared([item(1, 'https://b.test'), item(2, 'https://a.test')], [replacement])).toEqual([replacement, item(1, 'https://b.test')])
  })
  it('rejects scripts, local files and malformed destinations', () => {
    for (const url of ['javascript:alert(1)', 'file:///private', 'data:text/html,hello', 'invalid', undefined]) expect(safeSharedLink(url)).toBeNull()
    expect(safeSharedLink('https://example.com/a')).toBe('https://example.com/a')
  })
})
