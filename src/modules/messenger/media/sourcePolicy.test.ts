import { expect, it } from 'vitest'
import { trustedMediaUri } from './sourcePolicy'
it('restricts native media cookies to the configured file endpoint', () => {
  const origin = 'https://jm.example.test'
  expect(trustedMediaUri(`${origin}/api/jm/files/abc-123/?v=large`, origin)).toBe(true)
  for (const uri of ['https://other.test/api/jm/files/a/', `${origin}/api/jm/link-preview/`, `${origin}/api/jm/files/%2f/`, `${origin}/api/jm/files/a/#fragment`, 'https://user:pass@jm.example.test/api/jm/files/a/']) {
    expect(trustedMediaUri(uri, origin)).toBe(false)
  }
})
