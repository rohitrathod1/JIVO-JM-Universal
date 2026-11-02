import { expect, it } from 'vitest'
import { ConversationDrafts } from './drafts'
it('keeps each conversation draft and clears text at account boundaries', () => {
  const drafts = new ConversationDrafts(); drafts.bind('alice')
  drafts.write('alice', 'first', 'unfinished'); drafts.write('alice', 'second', 'another')
  expect(drafts.read('alice', 'first')).toBe('unfinished')
  drafts.write('alice', 'first', ''); expect(drafts.read('alice', 'first')).toBe('')
  drafts.bind(null); drafts.bind('bob'); drafts.write('alice', 'second', 'stale callback')
  expect(drafts.read('bob', 'second')).toBe('')
  drafts.bind('alice'); expect(drafts.read('alice', 'second')).toBe('')
})
