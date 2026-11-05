// Opens /messenger as the 500-conversation perfheavy user and records API requests, heap and DOM every 5 s
// for up to 120 s, so a hang/crash can be attributed. Usage: node heavy-list-probe.cjs <perf-accounts.json> <url> <outDir>
const fs = require('fs'), path = require('path')
const { chromium } = require(require.resolve('playwright', { paths: ['C:/Users/JIVO/Desktop/JM/JIVO-JM-Universal'] }))
const [accFile, url = 'http://127.0.0.1:4176/', outDir = '.'] = process.argv.slice(2)
const acc = JSON.parse(fs.readFileSync(accFile, 'utf8'))
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--enable-precise-memory-info'] })
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  await ctx.addCookies([{ name: 'jm_session', value: acc.heavy.user.session, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }])
  const p = await ctx.newPage(); const api = {}; const errors = []; let crashed = false
  p.on('pageerror', e => errors.push(e.message.slice(0, 200))); p.on('crash', () => { crashed = true })
  p.on('request', r => { const u = r.url().replace(/^https?:\/\/[^/]+/, ''); if (u.startsWith('/api/')) { const k = r.method() + ' ' + u.replace(/[0-9a-f-]{36}/g, '<id>').replace(/cursor=[^&]+/, 'cursor=*'); api[k] = (api[k] || 0) + 1 } })
  const t0 = Date.now(); const samples = []
  await p.goto(url + 'messenger', { waitUntil: 'commit' })
  while (Date.now() - t0 < 120000 && !crashed) {
    await p.waitForTimeout(5000).catch(() => {})
    if (crashed) break
    const s = await p.evaluate(() => ({ heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), dom: document.getElementsByTagName('*').length,
      rows: [...document.querySelectorAll('div')].filter(d => d.children.length === 0 && /^Perf Conv \d{3}$/.test(d.textContent || '')).length, path: location.pathname })).catch(e => ({ err: e.message.slice(0, 80) }))
    s.t = Math.round((Date.now() - t0) / 1000); s.apiCalls = Object.values(api).reduce((a, b) => a + b, 0); samples.push(s); console.log(JSON.stringify(s))
  }
  if (!crashed) await p.screenshot({ path: path.join(outDir, 'heavy-list-probe.png') }).catch(() => {})
  const out = { crashed, seconds: Math.round((Date.now() - t0) / 1000), samples, api, errors }
  fs.writeFileSync(path.join(outDir, 'heavy-list-probe.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ crashed, api }, null, 1)); await b.close()
})()
