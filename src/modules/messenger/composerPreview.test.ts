import { expect, it } from 'vitest'
import { previewLines, safePreviewImage } from './composerPreview'
it('keeps only small inline raster previews', () => {
  expect(safePreviewImage('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  for (const value of [null, undefined, '', 'https://example.com/a.png', 'data:image/svg+xml;base64,AAAA', `data:image/png;base64,${'A'.repeat(350000)}`]) expect(safePreviewImage(value)).toBeNull()
})
it('falls back to the domain for missing title and site', () => {
  expect(previewLines({ url: 'https://a.in', domain: 'a.in', title: ' ', description: ' Hi ', site_name: '', image: null })).toEqual({ title: 'a.in', description: 'Hi', site: 'a.in' })
})
