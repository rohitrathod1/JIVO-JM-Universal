import { expect, it } from 'vitest'
import { mediaUrl } from './url'
it('resolves only configured-origin relative media without protocol or backslash escapes', () => {
  expect(mediaUrl('/api/jm/uploads/file/download/', 'https://example.invalid')).toBe('https://example.invalid/api/jm/uploads/file/download/')
  for (const path of ['https://other.invalid/a', '//other.invalid/a', '/\\other.invalid/a', '/\na']) expect(mediaUrl(path, 'https://example.invalid')).toBeNull()
  expect(mediaUrl('/file', '')).toBeNull()
})
