// Rasterize extra lucide icons (same 72px / stroke 1.8 recipe as capture-ui-reference.cjs).
// Usage: node scripts/parity/icons.cjs Name1 Name2 ...
const { chromium } = require('playwright')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const reference = path.resolve(root, '../JIVO-JM-Frontend')
async function main() {
  const React = require(path.join(reference, 'node_modules/react'))
  const { renderToStaticMarkup } = require(path.join(reference, 'node_modules/react-dom/server'))
  const lucide = require(path.join(reference, 'node_modules/lucide-react'))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 72, height: 72 } })
    for (const name of process.argv.slice(2)) {
      if (!lucide[name]) { console.error('missing', name); continue }
      const svg = renderToStaticMarkup(React.createElement(lucide[name], { size: 72, strokeWidth: 1.8, color: '#000000' }))
      await page.setContent(`<html><body style="margin:0;width:72px;height:72px;background:transparent">${svg}</body></html>`)
      await page.screenshot({ path: path.join(root, `assets/icons/${name}.png`), omitBackground: true })
      console.log('ok', name)
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
