// Client performance probes for JM-Universal web (Edge via Playwright). Uses the perfheavy session from perf_seed.py
// (500 conversations + a 2,000-message direct chat with perfpeer). Never uses real accounts.
// Usage: node client-perf.cjs <perf-accounts.json> [url=http://127.0.0.1:4176/] [outDir] [memMinutes=10] [phase=all|load|memory]
const fs = require('fs'), path = require('path')
const { chromium } = require(require.resolve('playwright', { paths: ['C:/Users/JIVO/Desktop/JM/JIVO-JM-Universal'] }))
const [accFile, url = 'http://127.0.0.1:4176/', outDir = '.', memMin = '10', phase = 'all'] = process.argv.slice(2)
if (!/^http:\/\/127\.0\.0\.1:(4176|8091)\/$/.test(url)) { console.error('refusing: url must be the e2e proxy on 127.0.0.1:4176 or 8091'); process.exit(2) }
const acc = JSON.parse(fs.readFileSync(accFile, 'utf8'))
const heavy = acc.heavy.user
fs.mkdirSync(outDir, { recursive: true })
const tag = new URL(url).port
const result = { url, at: new Date().toISOString() }
const save = () => fs.writeFileSync(path.join(outDir, `client-perf-${tag}-${phase}.json`), JSON.stringify(result, null, 2))

const INIT = () => {
  window.__perf = { lcp: 0, lcpEl: '', longTasks: [], cls: 0 }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__perf.lcp = e.startTime; window.__perf.lcpEl = (e.element && (e.element.tagName + ' ' + (e.element.textContent || '').slice(0, 40))) || e.url } }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.longTasks.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: true }) } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch {}
}

async function newCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  await ctx.addCookies([{ name: 'jm_session', value: heavy.session, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }])
  await ctx.addInitScript(INIT)
  return ctx
}

// Waits until a role=tab locator reports aria-selected="true" (RN web maps accessibilityState.selected to it).
const expectSelected = async (locator, timeout = 15000) => { const t = Date.now(); while (await locator.getAttribute('aria-selected') !== 'true') { if (Date.now() - t > timeout) throw new Error('tab not selected'); await new Promise(r => setTimeout(r, 25)) } }

// rAF-based frame counter while an action runs: fps and worst frame gap
const fpsDuring = async (page, fn) => {
  await page.evaluate(() => { window.__frames = []; let last = performance.now(); const tick = t => { window.__frames.push(t - last); last = t; if (window.__fpsOn) requestAnimationFrame(tick) }; window.__fpsOn = true; requestAnimationFrame(tick) })
  const t = Date.now(); await fn(); const ms = Date.now() - t
  return page.evaluate(ms => { window.__fpsOn = false; const f = window.__frames.slice(1); const s = [...f].sort((a, b) => a - b)
    return { ms, frames: f.length, fps: +(f.length / (ms / 1000)).toFixed(1), p95FrameMs: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1), maxFrameMs: +(s[s.length - 1] || 0).toFixed(1), jank50: f.filter(x => x > 50).length } }, ms)
}

async function loadPhase(browser) {
  const ctx = await newCtx(browser); const page = await ctx.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  const reqs = []; page.on('requestfinished', async r => { try { const s = await r.sizes(); reqs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), type: r.resourceType(), bytes: s.responseBodySize + s.responseHeadersSize }) } catch {} })
  const wsEvents = []; page.on('websocket', ws => { const t0 = Date.now(); wsEvents.push({ open: t0 }); ws.on('close', () => wsEvents.push({ close: Date.now() })) })
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable')
  const t0 = Date.now()
  await page.goto(url + 'messenger', { waitUntil: 'commit' })
  await page.getByText(/^Perf Conv \d{3}$/).first().waitFor({ timeout: 180000 })
  const firstRowMs = Date.now() - t0
  // interactive: a click on a row must open the chat
  const t1 = Date.now()
  await page.getByText(/^Perf Conv \d{3}$/).first().click({ force: true })
  await page.getByText(/^hello \d+$|Perf Conv \d{3} created|created the group/i).first().waitFor({ timeout: 30000 }).catch(() => {})
  const firstOpenMs = Date.now() - t1
  await page.waitForTimeout(1500)
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const p = performance.getEntriesByType('paint'); return {
    ttfb: Math.round(n.responseStart), domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd),
    fcp: Math.round((p.find(x => x.name === 'first-contentful-paint') || {}).startTime || 0), lcp: Math.round(window.__perf.lcp), lcpEl: window.__perf.lcpEl,
    cls: +window.__perf.cls.toFixed(3), longTasks: window.__perf.longTasks.length, longTaskTotalMs: window.__perf.longTasks.reduce((a, b) => a + b[1], 0),
    longestTaskMs: Math.max(0, ...window.__perf.longTasks.map(x => x[1])), domNodes: document.getElementsByTagName('*').length } })
  result.coldLoad = { ...nav, firstConversationRowMs: firstRowMs, firstChatOpenMs: firstOpenMs,
    requests: reqs.length, transferredKB: Math.round(reqs.reduce((a, b) => a + b.bytes, 0) / 1024),
    scriptKB: Math.round(reqs.filter(r => r.type === 'script').reduce((a, b) => a + b.bytes, 0) / 1024),
    fontKB: Math.round(reqs.filter(r => r.type === 'font' || /\.ttf/.test(r.url)).reduce((a, b) => a + b.bytes, 0) / 1024),
    apiCalls: reqs.filter(r => r.url.startsWith('/api/')).map(r => r.url.split('?')[0]).reduce((m, u) => (m[u] = (m[u] || 0) + 1, m), {}) }
  await page.screenshot({ path: path.join(outDir, `cold-load-${tag}.png`) })
  console.log('coldLoad', JSON.stringify(result.coldLoad)); save()

  // 500 conversations: scroll the chat list to the end, paginating everything in
  const list = page.locator('div[class*="css-view"]').filter({ has: page.getByText(/^Perf Conv \d{3}$/) }).last()
  const scrollList = async () => page.evaluate(() => {
    const row = [...document.querySelectorAll('div')].find(d => /^Perf Conv \d{3}$/.test(d.textContent || '') && d.children.length === 0)
    let el = row; while (el && !(el.scrollHeight > el.clientHeight + 10 && getComputedStyle(el).overflowY !== 'visible')) el = el.parentElement
    if (!el) return null; el.scrollTop += 1200; return { top: el.scrollTop, h: el.scrollHeight, c: el.clientHeight }
  })
  const countRows = () => page.evaluate(() => [...document.querySelectorAll('div')].filter(d => d.children.length === 0 && /^Perf Conv \d{3}$/.test(d.textContent || '')).length)
  const tL = Date.now(); let rows = 0, stable = 0
  const fpsList = await fpsDuring(page, async () => {
    while (Date.now() - tL < 120000) { await scrollList(); await page.waitForTimeout(120); const n = await countRows(); if (n === rows) { if (++stable > 25) break } else { stable = 0; rows = n } }
  })
  result.conversationList = { rowsRendered: rows, msToLoadAll: Date.now() - tL, scroll: fpsList,
    domNodes: await page.evaluate(() => document.getElementsByTagName('*').length),
    heapMB: await page.evaluate(() => +(performance.memory.usedJSHeapSize / 1048576).toFixed(1)) }
  // a full re-render: switching the filter while 500 rows are mounted
  // The filter chips are role "tab" named by their label (ConversationWorkspace listFilters); a missing chip must fail the
  // probe, not add two locator timeouts to the timing.
  const chip = name => page.getByRole('tab', { name, exact: true }).first()
  const tf = Date.now(); await chip('Groups').click(); await expectSelected(chip('Groups'))
  result.conversationList.filterGroupsMs = Date.now() - tf
  const ta = Date.now(); await chip('All').click(); await expectSelected(chip('All')); await page.getByText(/^Perf Conv \d{3}$/).first().waitFor()
  result.conversationList.filterAllMs = Date.now() - ta
  result.conversationList.filterToggleMs = Date.now() - tf
  console.log('conversationList', JSON.stringify(result.conversationList)); save()

  // long chat (2,000 messages): open it and scroll up through history
  const tC = Date.now()
  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).first()
  await page.getByText(/^Perfpeer Perf$/).first().click({ timeout: 5000, force: true }).catch(async () => { await search.fill('Perfpeer'); await page.getByText(/^Perfpeer Perf$/).first().click({ force: true }) })
  // Scope everything to the thread (FlatList "Latest messages" / "Message history"): the chat-list row preview also shows
  // message 2000, and bubbles hold the body in nested elements (inline time spacer), so leaf-div matching found nothing.
  const thread = page.getByLabel(/^(Latest messages|Message history)$/).first()
  await thread.getByText(/Perf long-chat message 2000\./).first().waitFor({ timeout: 30000 })
  result.longChat = { openMs: Date.now() - tC }
  const threadHandle = await thread.elementHandle()
  // RN web puts the label on the ScrollView's scrolling div; fall back to the first scrollable descendant just in case.
  // op: 'up' (scroll 1500 px towards older), 'down' (3000 px towards newer) or 'atTop'. No eval, so a CSP cannot break it.
  const inThread = op => threadHandle.evaluate((root, op) => { const el = root.scrollHeight > root.clientHeight + 10 ? root
    : [...root.querySelectorAll('div')].find(d => d.scrollHeight > d.clientHeight + 10 && getComputedStyle(d).overflowY !== 'visible') || root
    if (op === 'up') el.scrollTop = Math.max(0, el.scrollTop - 1500); else if (op === 'down') el.scrollTop += 3000
    return el.scrollTop === 0 }, op)
  const seqs = () => threadHandle.evaluate(el => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n
    while ((n = w.nextNode())) { const m = /Perf long-chat message (\d{4})\./.exec(n.data); if (m) out.push(+m[1]) } return out })
  const oldest = async () => { const s = await seqs(); return s.length ? Math.min(...s) : null }
  // The thread is not inverted: older history is above (scrollTop 0). History pages in through "Load earlier messages".
  const loadEarlier = thread.getByRole('button', { name: 'Load earlier messages', exact: true })
  const tS = Date.now(); let oldestSeen = await oldest(); const samples = []; let pages = 0
  if (oldestSeen == null) throw new Error('long chat: no "Perf long-chat message" text inside the thread')
  const fpsChat = await fpsDuring(page, async () => {
    while (Date.now() - tS < 120000 && oldestSeen > 1) {
      await inThread('up')
      await page.waitForTimeout(80)
      if (await inThread('atTop') && await loadEarlier.isVisible().catch(() => false) && await loadEarlier.isEnabled().catch(() => false)) { await loadEarlier.click(); pages++ }
      const o = await oldest(); if (o != null && o !== oldestSeen) { oldestSeen = o; samples.push([Date.now() - tS, o]) }
    }
  })
  result.longChat = { ...result.longChat, reachedOldest: oldestSeen, reachedTop: oldestSeen === 1, earlierPages: pages, msScrolling: Date.now() - tS, scroll: fpsChat, progress: samples.filter((_, i) => i % 5 === 0),
    renderedMessages: (await seqs()).length,
    domNodes: await page.evaluate(() => document.getElementsByTagName('*').length),
    heapMB: await page.evaluate(() => +(performance.memory.usedJSHeapSize / 1048576).toFixed(1)) }
  await page.screenshot({ path: path.join(outDir, `long-chat-top-${tag}.png`) })
  // scroll back to the latest message (same thread element)
  const fpsDown = await fpsDuring(page, async () => { for (let i = 0; i < 40; i++) { await inThread('down'); await page.waitForTimeout(50) } })
  result.longChat.scrollDown = fpsDown
  console.log('longChat', JSON.stringify(result.longChat)); save()

  // websocket reconnect cost: offline 5 s then online; time to a new socket and the API calls made to resync
  const before = reqs.length; const wsBefore = wsEvents.filter(e => e.open).length
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  const tOff = Date.now(); await page.waitForTimeout(5000)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  const tOn = Date.now(); let reopenMs = null
  while (Date.now() - tOn < 60000) { const opens = wsEvents.filter(e => e.open); if (opens.length > wsBefore && opens[opens.length - 1].open >= tOff) { reopenMs = opens[opens.length - 1].open - tOn; break } await page.waitForTimeout(100) }
  await page.waitForTimeout(4000)
  const after = reqs.slice(before)
  result.wsReconnect = { offlineMs: tOn - tOff, socketsBefore: wsBefore, reopenAfterOnlineMs: reopenMs,
    resyncRequests: after.length, resyncKB: Math.round(after.reduce((a, b) => a + b.bytes, 0) / 1024),
    resyncApi: after.filter(r => r.url.startsWith('/api/')).map(r => r.url.split('?')[0]).reduce((m, u) => (m[u] = (m[u] || 0) + 1, m), {}) }
  console.log('wsReconnect', JSON.stringify(result.wsReconnect))
  result.pageErrors = errors; save()
  await ctx.close()
}

async function memoryPhase(browser, minutes) {
  const ctx = await newCtx(browser); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page)
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto(url + 'messenger'); await page.getByText(/^Perf Conv \d{3}$/).first().waitFor({ timeout: 180000 })
  const titles = ['Perfpeer Perf', ...Array.from({ length: 8 }, (_, i) => `Perf Conv ${String(499 - i).padStart(3, '0')}`)]
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); return page.evaluate(() => ({ usedMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), dom: document.getElementsByTagName('*').length })) }
  const samples = [{ t: 0, switches: 0, ...(await heap()) }]
  const t0 = Date.now(); let switches = 0, fails = 0, lastSample = t0
  while (Date.now() - t0 < minutes * 60000) {
    const title = titles[switches % titles.length]
    try { await page.getByText(new RegExp('^' + title + '$')).first().click({ timeout: 5000, force: true }); await page.waitForTimeout(700) } catch { fails++ }
    switches++
    if (Date.now() - lastSample > 30000) { lastSample = Date.now(); const s = { t: Math.round((Date.now() - t0) / 1000), switches, fails, ...(await heap()) }; samples.push(s); console.log('mem', JSON.stringify(s)) }
  }
  const end = { t: Math.round((Date.now() - t0) / 1000), switches, fails, ...(await heap()) }; samples.push(end)
  result.memory = { minutes, switches, fails, startMB: samples[0].usedMB, endMB: end.usedMB, growthMB: +(end.usedMB - samples[0].usedMB).toFixed(1),
    startDom: samples[0].dom, endDom: end.dom, samples, pageErrors: errors }
  await page.screenshot({ path: path.join(outDir, `memory-end-${tag}.png`) })
  console.log('memory', JSON.stringify({ ...result.memory, samples: undefined })); save()
  await ctx.close()
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-precise-memory-info'] })
  try {
    if (phase === 'all' || phase === 'load') await loadPhase(browser)
    if (phase === 'all' || phase === 'memory') await memoryPhase(browser, Number(memMin))
  } catch (e) { result.error = e.message; save(); console.error('FAIL', e.message); process.exitCode = 1 }
  await browser.close()
})()
