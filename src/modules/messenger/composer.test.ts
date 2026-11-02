import { expect, it } from 'vitest'
import { caretAfterEdit, insertMention, mentionAt } from './composer'
it('inserts a mention at the caret without destroying the rest of a draft', () => {
  expect(insertMention('Hello @Al, see you tomorrow', { start: 9, end: 9 }, 'Alice')).toEqual({
    text: 'Hello @Alice , see you tomorrow', caret: { start: 13, end: 13 },
  })
  expect(mentionAt('alice@example.test', { start: 10, end: 10 })).toBeNull()
  expect(mentionAt('@Alice', { start: 1, end: 4 })).toBeNull()
})
it('infers the caret for pasted/filled text before selection events arrive', () => {
  expect(caretAfterEdit('', '@Alice')).toEqual({ start: 6, end: 6 })
  expect(caretAfterEdit('hello world', 'hello @Al world')).toEqual({ start: 10, end: 10 })
})
