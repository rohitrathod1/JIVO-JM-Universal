// Read-only reference capture; all generated assets and screenshots stay in Universal.
const { chromium } = require('playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const reference = path.resolve(root, '../JIVO-JM-Frontend')
async function main() {
  await fs.mkdir(path.join(root, 'assets/brand'), { recursive: true })
  await fs.mkdir(path.join(root, 'assets/icons'), { recursive: true })
  await fs.mkdir(path.join(root, 'test-results/ui-parity'), { recursive: true })
  for (const file of ['jm-mark.png', 'jm-wordmark-dark.png', 'jm-wordmark-light.png']) {
    await fs.copyFile(path.join(reference, 'public/brand', file), path.join(root, 'assets/brand', file))
  }
  await fs.copyFile(path.join(reference, 'node_modules/lucide-react/LICENSE'), path.join(root, 'assets/icons/LICENSE'))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    if (!process.argv.includes('--icons-only')) { for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme })
      await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle' })
      await page.screenshot({ path: path.join(root, `test-results/ui-parity/reference-login-${theme}-1440.png`) })
      const css = await page.locator('.app-backdrop').evaluate(el => getComputedStyle(el).background)
      await page.setContent(`<html><body style="margin:0"><div style="width:1440px;height:1000px;background:${css}"></div></body></html>`)
      await page.screenshot({ path: path.join(root, `assets/brand/auth-backdrop-${theme}.png`) })
    }
    await page.setViewportSize({ width: 360, height: 1000 })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(root, 'test-results/ui-parity/reference-login-light-360.png') })
    }
    // Rasterize the reference's actual Lucide vectors once; RN tints these alpha PNGs on every platform.
    const React = require(path.join(reference, 'node_modules/react'))
    const { renderToStaticMarkup } = require(path.join(reference, 'node_modules/react-dom/server'))
    const lucide = require(path.join(reference, 'node_modules/lucide-react'))
    for (const name of ['MessageSquare', 'KeyRound', 'Bell', 'UserRound', 'Shield', 'LogOut', 'ChevronDown', 'EllipsisVertical', 'ArrowLeft', 'Plus', 'Send', 'Users', 'Pin', 'Search', 'Moon', 'Sun', 'Monitor', 'Eye', 'EyeOff', 'Clock3', 'AlertCircle', 'Check', 'CheckCheck', 'Lock', 'LockOpen', 'Home']) {
      const svg = renderToStaticMarkup(React.createElement(lucide[name], { size: 72, strokeWidth: 1.8, color: '#000000' }))
      await page.setViewportSize({ width: 72, height: 72 })
      await page.setContent(`<html><body style="margin:0;width:72px;height:72px;background:transparent">${svg}</body></html>`)
      await page.screenshot({ path: path.join(root, `assets/icons/${name}.png`), omitBackground: true })
    }
    // Exact TickMark geometry from the reference MessageBubble, including the two complete ticks.
    for (const [name, paths] of [['ReceiptSent', '<path d="M4.5 6.5 8 10l7-8"/>'], ['ReceiptDouble', '<path d="M1.5 6.5 5 10l7-8"/><path d="M8.3 9.3 9 10l7.5-8"/>']]) {
      await page.setViewportSize({ width: 60, height: 36 })
      await page.setContent(`<html><body style="margin:0;background:transparent"><svg width="60" height="36" viewBox="0 0 20 12" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></body></html>`)
      await page.screenshot({ path: path.join(root, `assets/icons/${name}.png`), omitBackground: true })
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
