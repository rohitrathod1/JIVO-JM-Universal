export interface Caret { start: number; end: number }
export function caretAfterEdit(previous: string, next: string): Caret {
  let prefix = 0; let suffix = 0
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++
  while (suffix < previous.length - prefix && suffix < next.length - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++
  const end = next.length - suffix
  return { start: end, end }
}
export function mentionAt(text: string, caret: Caret) {
  if (caret.start !== caret.end) return null
  const end = Math.max(0, Math.min(text.length, caret.end))
  const match = /(?:^|\s)@([^@\n]*)$/.exec(text.slice(0, end))
  if (!match || match[1].length > 80) return null
  return { start: end - match[1].length - 1, end, query: match[1] }
}
export function insertMention(text: string, caret: Caret, name: string) {
  const match = mentionAt(text, caret)
  if (!match) return { text, caret }
  const insert = `@${name} `
  const end = match.start + insert.length
  return { text: text.slice(0, match.start) + insert + text.slice(match.end), caret: { start: end, end } }
}

/** Reference Composer.tsx: Enter sends and Shift+Enter adds a line, except during IME composition or on a coarse (touch) pointer. */
export function enterSends(key: { key: string; shiftKey?: boolean; isComposing?: boolean }, coarse: boolean) {
  return key.key === 'Enter' && !key.shiftKey && !key.isComposing && !coarse
}
