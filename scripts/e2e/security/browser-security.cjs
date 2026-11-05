// Usage: node scripts/e2e/security/browser-security.cjs [step...]   steps: xss deeplink perms cache (default all)
// Browser security checks against the isolated stack (8091 dev web, 4176 PWA preview -> 8010). Synthetic accounts only.
const path = require('path'), fs = require('fs')
const { chromium, acc, API, api } = require('../messaging/lib.cjs')
const OUT = path.resolve(__dirname, '../../../test-results/e2e/security'); fs.mkdirSync(OUT, { recursive: true })
const DEV = 'http://127.0.0.1:8091/', PWA = process.env.JM_SEC_PWA || 'http://127.0.0.1:4176/'
const steps = process.argv.slice(2).length ? process.argv.slice(2) : ['xss', 'deeplink', 'perms', 'cache']
const results = []
const check = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(detail).slice(0, 600)) }
const MARK = 'SECX' + Date.now().toString(36)
const PAYLOADS = [
  `${MARK} <img src=x onerror="window.__xss=(window.__xss||0)+1">`,
  `${MARK} <script>window.__xss=(window.__xss||0)+1</script>`,
  `${MARK} [click me](javascript:window.__xss=1) and javascript:alert(document.domain)`,
  `${MARK} <a href="javascript:window.__xss=1">anchor</a> <svg/onload=window.__xss=1>`,
  `${MARK} https://example.com/"><img src=x onerror=window.__xss=1>`,
  `${MARK} data:text/html,<script>alert(1)</script> vbscript:msgbox(1) JaVaScRiPt:alert(1)`,
  `${MARK} https://example.com/${'a'.repeat(3000)}?q=${'b'.repeat(800)}`,
  `${MARK} {{constructor.constructor('window.__xss=1')()}} \${7*7} %3Cscript%3E`,
  `${MARK} ‮gnp.exe‬ RTL override and zero​width`,
]
async function newPage(browser, base, who, viewport = { width: 1440, height: 900 }, ctx) {
  ctx = ctx || await browser.newContext({ viewport })
  const page = await ctx.newPage(); page.errors = []; page.dialogs = []
  page.on('pageerror', e => page.errors.push(e.message)); page.on('dialog', d => { page.dialogs.push(d.message()); d.dismiss().catch(() => {}) })
  if (who) await signIn(page, base, who)
  return { ctx, page }
}
async function signIn(page, base, who) {
  const a = acc.accounts[who]
  await page.goto(base + 'login', { waitUntil: 'domcontentloaded', timeout: 240000 })
  await page.getByLabel(/email/i).first().waitFor({ timeout: 240000 })
  await page.waitForFunction(() => { const i = document.querySelector('input[type=email]'); return i && !i.readOnly }, null, { timeout: 120000 })
  await page.getByLabel(/email/i).first().fill(a.email); await page.getByLabel(/password/i).first().fill(a.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(u => !/\/login/.test(u.pathname), { timeout: 120000 })
  await page.waitForTimeout(2500)
  for (const n of [/not now/i, /dismiss/i]) { const b = page.getByRole('button', { name: n }); if (await b.count()) await b.first().click().catch(() => {}) }
}
async function signOut(page, base) {
  // Use the app's own sign-out path through the profile screen.
  await page.goto(base + 'profile', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  const so = page.locator('[aria-label="Sign out of JM on this device"]:visible').first()
  if (!(await so.count())) { await page.locator('text="This device" >> visible=true').first().click().catch(() => {}); await page.waitForTimeout(1200) }
  console.log('signout buttons total/visible', await page.locator('[aria-label="Sign out of JM on this device"]').count(), await so.count())
  try { await so.click({ timeout: 15000 }) } catch (e) {
    await page.screenshot({ path: OUT + '/signout-blocked.png' }); console.log('SIGNOUT-CLICK', e.message.split(String.fromCharCode(10)).slice(-6).join(' | ').slice(0, 700))
    await so.scrollIntoViewIfNeeded().catch(() => {}); await so.click({ force: true, timeout: 10000 })
  }
  await page.getByText('Sign out of JM?').first().waitFor({ timeout: 10000 })
  await page.locator('text="Sign out" >> visible=true').last().click({ timeout: 10000 })
  await page.waitForURL(u => /\/login/.test(u.pathname), { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
}
async function xss(browser) {
  const carol = await api('carol')
  const dave = acc.accounts.dave
  const conv = await carol.req('POST', '/api/jm/conversations/direct/', { user_id: dave.public_id })
  const cid = conv.body?.public_id || conv.body?.id || conv.data?.public_id
  check('setup: carol-dave direct chat', !!cid, { status: conv.status })
  if (!cid) return
  for (const body of PAYLOADS) { const r = await carol.req('POST', `/api/jm/conversations/${cid}/messages/`, { client_id: crypto.randomUUID(), body }); if (r.status >= 300) console.log('send', r.status, JSON.stringify(r.body).slice(0, 200)) ; await new Promise(r => setTimeout(r, 600)) }
  // File with an HTML file name.
  const fname = `<img src=x onerror=window.__xss=1>${MARK}.txt`
  const form = new FormData(); form.append('file', new Blob(['synthetic security test'], { type: 'text/plain' }), fname); form.append('purpose', 'attachment')
  const hdr = { Origin: API, Cookie: Object.entries(carol.jar).map(([k, v]) => k + '=' + v).join('; '), 'X-CSRFToken': carol.jar.jm_csrftoken, 'Idempotency-Key': crypto.randomUUID() }
  const up = await fetch(API + '/api/jm/uploads/', { method: 'POST', headers: hdr, body: form }); const upj = await up.json().catch(() => ({}))
  let upId = upj.id || upj.public_id; let status = upj.status
  for (let i = 0; i < 15 && upId && status !== 'ready' && status !== 'rejected'; i++) { await new Promise(r => setTimeout(r, 1000)); const g = await carol.req('GET', `/api/jm/uploads/${upId}/`); status = g.body?.status }
  if (upId && status === 'ready') { const r = await carol.req('POST', `/api/jm/conversations/${cid}/messages/`, { client_id: crypto.randomUUID(), body: MARK + ' file', upload_ids: [upId] }); check('setup: html-named file sent', r.status < 300, { status: r.status }) }
  else check('setup: html-named file upload', false, { upload: up.status, status, keys: Object.keys(upj).slice(0, 8) })
  const { ctx, page } = await newPage(browser, DEV, 'dave')
  // Open in-app (a full reload of the dev bundle is slow): the chat row preview shows the last message.
  await page.getByText(MARK + ' file').first().waitFor({ timeout: 90000 }).catch(() => {})
  await page.getByText(MARK + ' file').first().click().catch(() => {})
  await page.waitForTimeout(5000)
  if (await page.getByText(MARK).count() < 3) { await page.goto(DEV + 'messenger?conversation=' + cid, { waitUntil: 'domcontentloaded' }).catch(() => {}); await page.getByText(MARK + ' file').nth(1).waitFor({ timeout: 120000 }).catch(() => {}) }
  await page.waitForFunction(m => document.body.innerText.split(m).length > 6, MARK, { timeout: 180000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await page.screenshot({ path: OUT + '/xss-thread-1440.png' })
  const dom = await page.evaluate(mark => {
    const anchors = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^\s*(javascript|data|vbscript):/i.test(h))
    const injected = [...document.querySelectorAll('img[src="x"], script:not([src]), svg[onload]')].filter(e => (e.outerHTML || '').includes('__xss')).length
    const onAttrs = [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name) && /__xss/.test(a.value))).length
    const texts = document.body.innerText.split('\n').filter(l => l.includes(mark)).length
    const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth
    return { xss: window.__xss ?? null, anchors, injected, onAttrs, texts, overflow: sw - cw }
  }, MARK)
  check('XSS payloads render as text (no execution)', dom.xss === null && page.dialogs.length === 0, { ...dom, dialogs: page.dialogs })
  check('no injected elements / event-handler attributes', dom.injected === 0 && dom.onAttrs === 0, dom)
  check('no javascript:/data:/vbscript: links in DOM', dom.anchors.length === 0, dom.anchors)
  check('payload messages visible as text', dom.texts >= 5, { lines: dom.texts })
  check('very long URL does not overflow page horizontally', dom.overflow <= 1, { overflow: dom.overflow })
  // Click-test the link segment of the javascript: payload: must not run.
  const jsText = page.getByText('javascript:alert(document.domain)', { exact: false }).first()
  if (await jsText.count()) { await jsText.click().catch(() => {}); await page.waitForTimeout(800) }
  const popups = []; ctx.on('page', p => popups.push(p.url()))
  const long = page.locator('a, [role=link]').filter({ hasText: 'example.com/' }).first()
  const longInfo = await long.count() ? await long.evaluate(e => ({ tag: e.tagName, href: e.getAttribute('href'), w: e.getBoundingClientRect().width })) : null
  check('clicking javascript: text runs nothing', (await page.evaluate(() => window.__xss ?? null)) === null && page.dialogs.length === 0, { dialogs: page.dialogs, longLink: longInfo && { tag: longInfo.tag, hrefLen: longInfo.href?.length, width: Math.round(longInfo.w) } })
  // Phone width
  await page.setViewportSize({ width: 360, height: 780 }); await page.waitForTimeout(1500)
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await page.screenshot({ path: OUT + '/xss-thread-360.png' })
  check('long URL message at 360px has no horizontal overflow', ov <= 1, { overflow: ov })
  check('no page errors in xss thread', page.errors.length === 0, page.errors.slice(0, 3))
  fs.writeFileSync(OUT + '/xss-conversation.json', JSON.stringify({ conversation: cid, mark: MARK }))
  await ctx.close()
}
async function deeplink(browser) {
  const { ctx, page } = await newPage(browser, DEV, 'bob')
  const cases = ['//evil.example/x', 'https://evil.example/', '/\\evil.example', '/%2F%2Fevil.example', '/%5C%5Cevil.example', 'javascript:alert(1)', '/%0d%0a//evil.example', '/messenger?x=1#//evil.example', '%2F%2Fevil.example']
  for (const next of cases) {
    await page.goto(DEV + 'login?next=' + encodeURIComponent(next), { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(2500)
    const u = new URL(page.url())
    check(`login?next=${next} stays on origin`, u.origin === new URL(DEV).origin && page.dialogs.length === 0, { landed: u.origin + u.pathname })
  }
  for (const p of ['invite/%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E', 'reset-password/javascript:alert(1)', 'invite/..%2F..%2Fadmin', 'reset-password/%2F%2Fevil.example']) {
    const { ctx: c2, page: anon } = await newPage(browser, DEV, null)
    await anon.goto(DEV + p, { waitUntil: 'domcontentloaded' }).catch(() => {}); await anon.waitForTimeout(4000)
    const u = new URL(anon.url()); const x = await anon.evaluate(() => window.__xss ?? null)
    const text = (await anon.locator('body').innerText()).slice(0, 160).replace(/\s+/g, ' ')
    check(`anon /${p} safe`, u.origin === new URL(DEV).origin && x === null && anon.dialogs.length === 0, { landed: u.pathname, text })
    await anon.screenshot({ path: OUT + '/deeplink-' + p.split('/')[0] + '-' + results.length + '.png' }); await c2.close()
  }
  await ctx.close()
}
async function perms(browser) {
  const { ctx, page } = await newPage(browser, DEV, 'dave')
  const adminCalls = []; page.on('response', r => { if (/\/api\/jm\/admin\//.test(r.url())) adminCalls.push(r.status()) })
  const navText = await page.locator('body').innerText()
  check('dave: no Administration entry in navigation', !/Administration/.test(navText), { found: /Administration/.test(navText) })
  // approvals (JP_ACCESS) and alerts (JM_ALERT_VIEW) are allowed for dave, as in the reference; only admin must be denied.
  for (const route of ['admin']) {
    await page.goto(DEV + route, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000)
    const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
    const u = new URL(page.url()).pathname
    const denied = /do not have access|not allowed|no access|permission|not enabled for your account/i.test(t) || u !== '/' + route
    const showsUsers = /alice@e2e\.invalid|bob@e2e\.invalid/.test(t)
    await page.screenshot({ path: OUT + `/perms-dave-${route}.png` })
    check(`dave /${route}: UI denies or redirects, no admin data`, denied && !showsUsers, { path: u, snippet: t.slice(0, 160) })
  }
  check('dave: any admin API call made was refused', adminCalls.every(s => s === 403 || s === 401), { adminCalls })
  await ctx.close()
}
async function storageDump(page) {
  return page.evaluate(async () => {
    const out = { caches: {}, idb: {}, local: {}, session: {} }
    for (const k of await caches.keys()) { const c = await caches.open(k); const reqs = await c.keys(); out.caches[k] = reqs.map(r => new URL(r.url).pathname) }
    for (const d of (await indexedDB.databases?.()) || []) {
      out.idb[d.name] = await new Promise(res => { const rq = indexedDB.open(d.name); rq.onsuccess = () => { const db = rq.result; const stores = [...db.objectStoreNames]; if (!stores.length) { db.close(); return res({}) } const tx = db.transaction(stores, 'readonly'); const o = {}; let n = stores.length; stores.forEach(s => { const g = tx.objectStore(s).getAll(); g.onsuccess = () => { o[s] = JSON.stringify(g.result).slice(0, 4000); if (--n === 0) { db.close(); res(o) } }; g.onerror = () => { if (--n === 0) { db.close(); res(o) } } }) }; rq.onerror = () => res('err') })
    }
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out.local[k] = (localStorage.getItem(k) || '').slice(0, 300) }
    for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); out.session[k] = (sessionStorage.getItem(k) || '').slice(0, 300) }
    out.swControlled = !!navigator.serviceWorker?.controller
    return out
  })
}
async function cache(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const { page } = await newPage(browser, PWA, 'alice', undefined, ctx)
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000) // ensure SW controls
  // Open the alice-bob chat and type an unsent draft, then queue an offline message.
  await page.getByText('Bob E2E').first().click().catch(() => {}); await page.getByPlaceholder('Message').first().waitFor({ timeout: 90000 }).catch(() => {}); await page.waitForTimeout(2000)
  const DRAFT = 'ALICEDRAFT' + MARK, QUEUED = 'ALICEQUEUED' + MARK
  const box = page.getByPlaceholder('Message').first(); await box.fill(DRAFT).catch(() => {})
  await ctx.setOffline(true); await page.waitForTimeout(1000)
  await box.fill(QUEUED).catch(() => {}); await box.press('Enter').catch(() => {}); await page.waitForTimeout(2000)
  const before = await storageDump(page)
  const queuedStored = JSON.stringify(before.idb).includes(QUEUED)
  await ctx.setOffline(false); await page.waitForTimeout(500)
  // Sign out quickly; message may flush first which is fine. Re-queue offline before sign-out to test clearing.
  await ctx.setOffline(true); await box.fill(QUEUED + '2').catch(() => {}); await box.press('Enter').catch(() => {}); await page.waitForTimeout(1500)
  const before2 = await storageDump(page)
  await ctx.setOffline(false)
  await page.route('**/api/jm/conversations/*/messages/', r => r.request().method() === 'POST' ? r.abort() : r.continue()) // keep queue unsent during sign-out
  await signOut(page, PWA)
  await page.unroute('**/api/jm/conversations/*/messages/')
  const after = await storageDump(page)
  const afterStr = JSON.stringify(after)
  check('offline message was persisted to outbox before sign-out (control)', queuedStored || JSON.stringify(before2.idb).includes(QUEUED + '2'), { idbDbs: Object.keys(before2.idb) })
  check('sign-out clears outbox / drafts / alice data from browser storage', !afterStr.includes(QUEUED) && !afterStr.includes(DRAFT) && !afterStr.includes(acc.accounts.alice.public_id), { idb: Object.keys(after.idb), local: Object.keys(after.local), session: Object.keys(after.session) })
  const apiCached = Object.values(after.caches).flat().filter(p => /^\/(api|ws|media|uploads)/.test(p))
  check('SW caches contain no /api, /media or upload responses', apiCached.length === 0, { swControlled: after.swControlled, cacheNames: Object.keys(after.caches), apiCached })
  // Bob signs in on the same browser profile.
  await signIn(page, PWA, 'bob'); await page.waitForTimeout(3000)
  const bobText = await page.locator('body').innerText()
  const bobStore = JSON.stringify(await storageDump(page))
  check('bob does not see alice draft/queued text after shared-browser switch', !bobText.includes(DRAFT) && !bobText.includes(QUEUED) && !bobStore.includes(QUEUED) && !bobStore.includes(DRAFT), {})
  // Offline reload as bob: shell only, no alice data served from cache
  await ctx.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(4000)
  const offText = await page.locator('body').innerText().catch(() => '')
  await page.screenshot({ path: OUT + '/cache-bob-offline.png' })
  check('offline reload as bob shows no alice-only content', !offText.includes(DRAFT) && !offText.includes(QUEUED), { snippet: offText.slice(0, 160).replace(/\s+/g, ' ') })
  await ctx.setOffline(false)
  // clean up: sign out bob
  await signOut(page, PWA).catch(() => {})
  check('no page errors in cache flow', page.errors.length === 0, page.errors.slice(0, 3))
  fs.writeFileSync(OUT + '/storage-after-signout.json', JSON.stringify({ before: Object.keys(before2.idb), after: { caches: after.caches, idb: Object.keys(after.idb), local: Object.keys(after.local), session: Object.keys(after.session) } }, null, 2))
  await ctx.close()
}
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const s of steps) { try { await ({ xss, deeplink, perms, cache })[s](browser) } catch (e) { check(`step ${s} completed`, false, { error: e.message.slice(0, 300) }) } }
  await browser.close()
  const file = OUT + '/browser-security-' + steps.join('-') + '.json'; fs.writeFileSync(file, JSON.stringify(results, null, 2))
  console.log('summary', results.filter(r => r.pass).length, '/', results.length, '->', file)
})()
