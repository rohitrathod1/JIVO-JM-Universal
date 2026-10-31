const { chromium } = require('@playwright/test')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

async function main() {
  const root = path.resolve('dist')
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    let file = path.resolve(root, '.' + pathname)
    if (!file.startsWith(root + path.sep)) file = path.join(root, 'index.html')
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
    const mime = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    fs.mkdirSync('test-results', { recursive: true })
    for (const width of [360, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []
      const apiRequests = []
      page.on('pageerror', e => errors.push(e.message))
      page.on('request', r => { if (r.url().includes('/api/')) apiRequests.push(r.url()) })
      const base = `http://127.0.0.1:${server.address().port}`
      await page.goto(base + '/login')
      await page.getByRole('button', { name: 'Continue' }).waitFor()
      await page.getByLabel('Email address').fill('preview@example.invalid')
      await page.getByLabel('Password', { exact: true }).fill('local-preview-only')
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.getByRole('alert').filter({ hasText: 'Configure EXPO_PUBLIC_API_ORIGIN' }).waitFor()
      await page.goto(base + '/preview')
      await page.getByText('Design team', { exact: true }).waitFor()
      await page.getByLabel('Search conversations').fill('Operations')
      await page.getByText('Operations', { exact: true }).waitFor()
      assert.equal(await page.getByText('Design team', { exact: true }).count(), 0)
      await page.getByLabel('Search conversations').fill('')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`)
      await page.screenshot({ path: `test-results/preview-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [], `runtime errors at ${width}`)
      assert.deepEqual(apiRequests, [], 'Preview/configuration guard must not contact backend')
      await page.goto(base + '/passwords')
      await page.getByRole('button', { name: 'Continue' }).waitFor()
      console.log(`PASS ${width}px: login guard, preview filtering, no overflow, protected route, no backend requests`)
      await page.close()
    }
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
