import { describe, expect, it, vi } from 'vitest'

vi.mock('react-native', () => ({ Platform: { OS: 'web', select: (o: Record<string, unknown>) => o.web ?? o.default }, StyleSheet: { create: (s: unknown) => s, flatten: (s: unknown) => s }, Dimensions: { get: () => ({ width: 390, height: 844 }) } }))
vi.mock('./core/theme/useTheme', () => ({ useTheme: () => ({ dark: false }) }))
vi.mock('./components/Icon', () => ({ Icon: () => null }))

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('theme contrast tokens (WCAG AA, DEF-006)', () => {
  it('keeps accent text and white-on-fill badges at 4.5:1 in both themes', async () => {
    const { palette } = await import('./ui')
    for (const theme of [palette.light, palette.dark]) {
      for (const surface of [theme.bg, theme.shell, theme.panel]) expect(contrast(theme.brand, surface), `${theme.brand} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      for (const fill of [theme.primary, theme.brandFill, theme.dangerFill, theme.warningFill]) expect(contrast('#ffffff', fill), `white on ${fill}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('gives every avatar colour white initials at 4.5:1', async () => {
    const { avatarColors } = await import('./components/ChatAvatar')
    for (const color of avatarColors) expect(contrast('#ffffff', color), color).toBeGreaterThanOrEqual(4.5)
  })
})
