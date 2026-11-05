// Shared primitives parity: account hold menu, "Sign out of JM?" confirm dialog, bell menu keyboard, tab bar.
const { chromium } = require('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const { fixtures } = require('./shell.cjs')
const dir = path.resolve(__dirname, '../../test-results/parity/primitives')
async function main() {
  await fs.mkdir(dir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const widths = process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : [390, 1440]
  const themes = process.env.THEMES ? process.env.THEMES.split(',') : ['light', 'dark']
  try {
    for (const [app, base] of [['reference', 'http://localhost:5174'], ['universal', process.env.JM_UI_URL || 'http://localhost:8090']]) {
      if (process.env.JM_UI_APP && process.env.JM_UI_APP !== app) continue
      for (const theme of themes) for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme, serviceWorkers: 'block' })
        await fixtures(context)
        await context.addInitScript(() => { try { localStorage.setItem('jm.push.prompt-dismissed.me', String(Date.now())) } catch {} })
        const page = require('./settle.cjs').settleImages(await context.newPage())
        const shot = name => page.screenshot({ path: path.join(dir, `${name}-${theme}-${width}-${app}.png`) })
        if (process.env.DEBUG) page.on('pageerror', e => console.log(app, 'pageerror', e.message))
        await page.goto(`${base}/home`, { waitUntil: 'networkidle' }).catch(() => {})
        await page.waitForTimeout(1500)
        if (width < 768) {
          await page.screenshot({ path: path.join(dir, `tabbar-${theme}-${width}-${app}.png`), clip: { x: 0, y: 844 - 80, width, height: 80 } })
          const tab = page.getByLabel(/^Profile: /).last(); const box = await tab.boundingBox()
          if (app === 'reference') await tab.click({ button: 'right' })
          else { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up() }
          await page.waitForTimeout(500); await shot('account-menu')
          await page.getByRole('menuitem', { name: 'Sign out' }).click(); await page.waitForTimeout(600); await shot('signout')
          // The same open dialog on desktop (the reference Profile tab is phone-only, so resize instead of navigating).
          await page.setViewportSize({ width: 1440, height: 844 }); await page.waitForTimeout(600); await page.screenshot({ path: path.join(dir, `signout-${theme}-1440-${app}.png`) }); await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(300)
          await page.keyboard.press('Escape'); await page.waitForTimeout(300); await shot('after-escape')
        } else {
          await page.getByRole('button', { name: /^Notifications/ }).first().click(); await page.waitForTimeout(1200)
          await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200); await shot('bell-keys')
          await page.keyboard.press('Escape'); await page.waitForTimeout(300); await shot('bell-escape')
        }
        await context.close()
      }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
