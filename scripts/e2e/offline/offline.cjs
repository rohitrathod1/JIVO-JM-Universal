// Offline/outbox e2e. Usage: node scripts/e2e/offline/offline.cjs [base=http://127.0.0.1:8091] [scenarios=all|a,b]
// Sender: carol in the browser. Receiver: dave via API + websocket. Uses a carol<->dave direct chat (isolated from alice/bob testers).
const L = require('./lib.cjs')
const base = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
if (!/^http:\/\/127\.0\.0\.1:(8091|4176)$/.test(base)) throw Error('only the e2e proxies are allowed')
const port = new URL(base).port
const only = (process.argv[3] || 'all').split(',')
const tag = `OFF${port}-${Date.now().toString(36)}`
const results = []; const shots = (n) => `${L.OUT}/${port}-${n}.png`

async function main() {
  const dave = new L.ApiUser('dave'); await dave.login()
  const carolApi = new L.ApiUser('carol'); await carolApi.login()
  const open = await dave.req('POST', '/conversations/direct/', { user_id: L.acc.accounts.carol.public_id })
  if (open.status >= 300) throw Error('openDirect ' + open.status + JSON.stringify(open.data).slice(0, 200))
  const conv = open.data.id
  const sock = dave.socket()
  const b = await L.browser()
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'allow' })
  const errors = []
  let page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message))
  await L.uiLogin(page, base, 'carol')
  await L.openChat(page, base, conv)

  async function delivered(bodies, after, timeout = 60000) {
    const got = await L.until(async () => { const m = await dave.messagesAfter(conv, after); const mine = m.filter(x => x.body && x.body.startsWith(tag)); return mine.filter(x => bodies.includes(x.body)).length >= bodies.length ? m : null }, timeout, 1000)
    const m = got || await dave.messagesAfter(conv, after)
    const mine = m.filter(x => bodies.includes(x.body)).map(x => x.body)
    const dup = mine.filter((x, i) => mine.indexOf(x) !== i)
    const order = JSON.stringify(mine.filter((x, i) => mine.indexOf(x) === i)) === JSON.stringify(bodies.filter(x => mine.includes(x)))
    return { count: mine.length, expected: bodies.length, missing: bodies.filter(x => !mine.includes(x)), duplicates: dup, inOrder: order, seqs: m.filter(x => bodies.includes(x.body)).map(x => x.seq) }
  }
  function wsGot(bodies, since) { const ev = sock.events.filter(e => e.at >= since && e.type === 'MESSAGE_CREATED').map(e => e.data?.body ?? e.data?.message?.body); return bodies.filter(x => ev.includes(x)).length }
  async function run(name, fn) {
    if (!only.includes('all') && !only.includes(name)) return
    const t = Date.now(); let r
    try { r = await fn(); results.push({ name, ok: r.ok !== false, ms: Date.now() - t, ...r }) } catch (e) { results.push({ name, ok: false, ms: Date.now() - t, error: String(e && e.stack || e).slice(0, 800) }); try { await page.screenshot({ path: shots(name + '-error') }) } catch { /* */ } }
    try { await ctx.setOffline(false) } catch { /* */ }
    console.log(name, JSON.stringify(results[results.length - 1]).slice(0, 600))
  }

  // A. queue while offline, pending state, then reconnect delivers exactly once in order
  await run('A-offline-queue', async () => {
    const after = await dave.latestSeq(conv); const since = Date.now()
    await ctx.setOffline(true); await L.sleep(800)
    const banner = await page.getByText('Offline. Messages will send when connected.').first().isVisible().catch(() => false)
    const bodies = [1, 2, 3, 4, 5].map(i => `${tag} A${i}`)
    for (const x of bodies) await L.typeAndSend(page, x)
    await L.sleep(1000)
    const queuedTicks = await page.getByRole('img', { name: 'Waiting for the network' }).count()
    const sendingTicks = await page.getByRole('img', { name: 'Sending' }).count()
    const visible = await Promise.all(bodies.map(x => page.getByText(x, { exact: true }).first().isVisible().catch(() => false)))
    const idb = await L.idbOutbox(page)
    const serverWhileOffline = (await dave.messagesAfter(conv, after)).filter(m => bodies.includes(m.body)).length
    await page.screenshot({ path: shots('A-offline-queued') })
    await ctx.setOffline(false)
    const d = await delivered(bodies, after, 60000)
    await L.sleep(1500)
    const idbAfter = await L.idbOutbox(page)
    const pendingAfter = await page.getByRole('img', { name: 'Waiting for the network' }).count()
    await page.screenshot({ path: shots('A-online-delivered') })
    const ok = banner && visible.every(Boolean) && idb.length === 5 && serverWhileOffline === 0 && d.count === 5 && d.duplicates.length === 0 && d.inOrder && idbAfter.length === 0 && pendingAfter === 0
    return { ok, banner, queuedTicks, sendingTicks, visible, idb, serverWhileOffline, delivery: d, ws: wsGot(bodies, since), idbAfter, pendingAfter }
  })

  // B. reload while offline (app shell + cached conversations)
  await run('B-offline-reload', async () => {
    await ctx.setOffline(true); await L.sleep(500)
    const bodies = [`${tag} B1`, `${tag} B2`]; const after = await dave.latestSeq(conv)
    for (const x of bodies) await L.typeAndSend(page, x)
    let reload = 'ok'
    try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }) } catch (e) { reload = String(e.message).split('\n')[0] }
    await L.sleep(6000)
    await page.screenshot({ path: shots('B-offline-reloaded') })
    const text = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).slice(0, 600)
    const shell = !/ERR_INTERNET_DISCONNECTED|This site can|No internet/i.test(text) && text.length > 0
    const historyVisible = await page.getByText(`${tag} A1`, { exact: true }).first().isVisible().catch(() => false)
    const queuedVisible = await page.getByText(`${tag} B1`, { exact: true }).first().isVisible().catch(() => false)
    const idb = await L.idbOutbox(page).catch(e => ({ error: String(e) }))
    await ctx.setOffline(false)
    if (reload !== 'ok' || !shell) { try { await page.reload({ waitUntil: 'domcontentloaded' }) } catch { /* */ } }
    const d = await delivered(bodies, after, 60000)
    return { ok: shell && d.count === 2 && d.duplicates.length === 0 && d.inOrder, reload, shell, text, historyVisible, queuedVisible, idb, delivery: d, note: 'design.md: browser history is memory-only, cold start offline stays locked' }
  })

  // ensure chat open again
  if (!(await L.composer(page).isVisible().catch(() => false))) await L.openChat(page, base, conv)

  // C. app restart (new page) with queue pending
  await run('C-restart-with-queue', async () => {
    await L.openChat(page, base, conv)
    const after = await dave.latestSeq(conv)
    await ctx.setOffline(true); await L.sleep(500)
    const bodies = [`${tag} C1`, `${tag} C2`, `${tag} C3`]
    for (const x of bodies) await L.typeAndSend(page, x)
    const idbBefore = await L.idbOutbox(page)
    await page.close()
    await ctx.setOffline(false)
    page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${base}/messenger?conversation=${conv}`, { waitUntil: 'domcontentloaded' })
    const d = await delivered(bodies, after, 60000)
    await L.composer(page).waitFor({ timeout: 30000 }).catch(() => {})
    await L.sleep(1500)
    const idbAfter = await L.idbOutbox(page)
    await page.screenshot({ path: shots('C-restart-delivered') })
    return { ok: idbBefore.length === 3 && d.count === 3 && d.duplicates.length === 0 && d.inOrder && idbAfter.length === 0, idbBefore: idbBefore.length, delivery: d, idbAfter }
  })

  // D. flapping network while sending
  await run('D-flapping', async () => {
    await L.openChat(page, base, conv)
    const after = await dave.latestSeq(conv)
    const bodies = Array.from({ length: 10 }, (_, i) => `${tag} D${String(i + 1).padStart(2, '0')}`)
    let off = false
    const flap = setInterval(() => { off = !off; void ctx.setOffline(off).catch(() => {}) }, 450)
    const sendErrors = []
    for (const x of bodies) { try { await L.typeAndSend(page, x) } catch (e) { sendErrors.push(x + ': ' + String(e.message).slice(0, 100)) } await L.sleep(150) }
    await L.sleep(4000); clearInterval(flap); await ctx.setOffline(false)
    const d = await delivered(bodies, after, 90000)
    await L.sleep(1500)
    const idbAfter = await L.idbOutbox(page)
    const failed = await page.getByRole('img', { name: 'Not sent' }).count()
    await page.screenshot({ path: shots('D-flapping-after') })
    return { ok: sendErrors.length === 0 && d.count === 10 && d.duplicates.length === 0 && d.inOrder && idbAfter.length === 0 && failed === 0, sendErrors, delivery: d, idbAfter, failedBubbles: failed }
  })

  // E. lost acknowledgement: server stores the message but the browser never sees the response -> retry must not duplicate
  await run('E-lost-ack-idempotency', async () => {
    await L.openChat(page, base, conv)
    const after = await dave.latestSeq(conv)
    let hits = 0
    await page.route(`**/api/jm/conversations/${conv}/messages/`, async route => {
      if (route.request().method() !== 'POST') return route.continue()
      hits++
      if (hits === 1) { await route.fetch(); return route.abort('connectionreset') }
      return route.continue()
    })
    const body = `${tag} E1`
    await L.typeAndSend(page, body)
    const d = await delivered([body], after, 30000)
    await L.until(async () => (await L.idbOutbox(page)).length === 0, 30000)
    await page.unroute(`**/api/jm/conversations/${conv}/messages/`)
    await L.sleep(1500)
    const all = (await dave.messagesAfter(conv, after)).filter(m => m.body === body)
    const domCopies = await page.getByText(body, { exact: true }).count()
    await page.screenshot({ path: shots('E-lost-ack') })
    return { ok: hits >= 2 && all.length === 1 && domCopies === 1, postAttempts: hits, serverCopies: all.length, domCopies, delivery: d }
  })

  // F. edit / delete / reaction while offline
  await run('F-offline-edit-delete-react', async () => {
    await L.openChat(page, base, conv)
    const seed = `${tag} F-target`
    await L.typeAndSend(page, seed)
    await L.until(async () => (await L.idbOutbox(page)).length === 0, 20000)
    await page.getByText(seed, { exact: true }).last().waitFor()
    await L.sleep(1500)
    await ctx.setOffline(true); await L.sleep(600)
    const out = {}
    async function openActions() {
      const bubble = page.getByText(seed, { exact: true }).last(); await bubble.hover()
      const btn = page.getByRole('button', { name: 'Message actions' })
      // pick the actions button nearest to the bubble
      const box = await bubble.boundingBox(); const n = await btn.count(); let best = null, bd = 1e9
      for (let i = 0; i < n; i++) { const bb = await btn.nth(i).boundingBox().catch(() => null); if (bb && box) { const dd = Math.abs(bb.y - box.y); if (dd < bd) { bd = dd; best = btn.nth(i) } } }
      if (best) await best.click({ force: true }); else await bubble.click({ button: 'right' })
      await page.getByLabel('Message options').first().waitFor({ timeout: 5000 })
    }
    // reaction
    try {
      await openActions(); await page.screenshot({ path: shots('F-actions-offline') })
      const react = page.getByRole('button', { name: /^React with|👍/ }).first()
      await react.click({ timeout: 4000 }); await L.sleep(1500)
      out.react = { alert: await page.getByRole('alert').allInnerTexts().catch(() => []), body: (await page.evaluate(() => document.body.innerText)).match(/(Cannot reach[^\n]*|Network[^\n]*|offline[^\n]*|connection[^\n]*)/i)?.[0] || null }
      await page.keyboard.press('Escape')
    } catch (e) { out.react = { error: String(e.message).split('\n')[0] } }
    // edit
    try {
      await openActions(); await page.getByRole('button', { name: /^Edit/ }).first().click({ timeout: 4000 })
      const box = L.composer(page); await box.fill(seed + ' edited'); await page.getByRole('button', { name: 'Save edit' }).click(); await L.sleep(2000)
      out.edit = { composerValue: await box.inputValue().catch(() => null), visibleError: (await page.evaluate(() => document.body.innerText)).match(/(Cannot reach[^\n]*|Network[^\n]*|connection[^\n]*)/i)?.[0] || null }
      await page.screenshot({ path: shots('F-edit-offline') })
      // cancel edit
      const cancel = page.getByRole('button', { name: /Cancel edit|Cancel editing|Close/ }).first(); if (await cancel.isVisible().catch(() => false)) await cancel.click()
      await box.fill('')
    } catch (e) { out.edit = { error: String(e.message).split('\n')[0] } }
    // delete
    try {
      await openActions(); await page.getByRole('button', { name: /^Delete/ }).first().click({ timeout: 4000 })
      const forAll = page.getByRole('button', { name: /everyone/i }).first(); if (await forAll.isVisible().catch(() => false)) await forAll.click()
      await L.sleep(2000)
      out.del = { stillVisible: await page.getByText(seed, { exact: true }).last().isVisible().catch(() => false), visibleError: (await page.evaluate(() => document.body.innerText)).match(/(Cannot reach[^\n]*|Network[^\n]*|connection[^\n]*)/i)?.[0] || null }
      await page.screenshot({ path: shots('F-delete-offline') })
      await page.keyboard.press('Escape')
    } catch (e) { out.del = { error: String(e.message).split('\n')[0] } }
    await ctx.setOffline(false); await L.sleep(4000)
    const server = (await dave.messagesAfter(conv, 0).catch(() => [])).filter(m => m.body && m.body.startsWith(seed))
    out.serverAfterReconnect = server.map(m => ({ body: m.body, deleted: m.deleted_at || m.is_deleted || null, reactions: m.reactions }))
    return { ok: undefined, ...out, note: 'Design: only text sends are queued; edits/deletes/reactions need connectivity. Check error surfaced and nothing applied silently.' }
  })

  // G. attachment queued offline
  await run('G-offline-attachment', async () => {
    await L.openChat(page, base, conv)
    const after = await dave.latestSeq(conv)
    const png = Buffer.from((await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'); g.fillStyle = '#2a7'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#fff'; g.fillRect(8, 8, 20, 20); return c.toDataURL('image/png') })).split(',')[1], 'base64')
    await ctx.setOffline(true); await L.sleep(600)
    const caption = `${tag} G-file`
    await page.getByRole('button', { name: 'Attach' }).last().click()
    const chooserP = page.waitForEvent('filechooser', { timeout: 8000 })
    await page.getByRole('menuitem', { name: 'Document' }).click()
    const chooser = await chooserP
    await chooser.setFiles({ name: 'offline-e2e.png', mimeType: 'image/png', buffer: png })
    await page.getByLabel('Attachment caption').waitFor({ timeout: 10000 })
    await page.getByLabel('Attachment caption').fill(caption)
    await page.getByRole('button', { name: 'Send files' }).click()
    await L.sleep(2000)
    const idb = await L.idbOutbox(page)
    const mediaRows = await page.evaluate(() => new Promise(res => { const r = indexedDB.open('jm-pending-media'); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('files')) { res(-1); return } const g = db.transaction('files').objectStore('files').count(); g.onsuccess = () => res(g.result) }; r.onerror = () => res(-2) }))
    const previewOpen = await page.getByLabel('Attachment caption').isVisible().catch(() => false)
    const pendingBubble = await page.getByText(caption, { exact: true }).first().isVisible().catch(() => false)
    await page.screenshot({ path: shots('G-attachment-offline') })
    await ctx.setOffline(false)
    const d = await delivered([caption], after, 120000)
    const msg = (await dave.messagesAfter(conv, after)).find(m => m.body === caption)
    return { ok: idb.length === 1 && idb[0].media === 1 && !previewOpen && pendingBubble && d.count === 1 && d.duplicates.length === 0 && (msg?.attachments?.length === 1), idb, mediaRows, previewOpen, pendingBubble, delivery: d, attachments: msg?.attachments?.map(a => ({ name: a.name, kind: a.kind, size: a.size })) }
  })

  // H. two tabs share one outbox: each queued message delivered once
  await run('H-two-tabs', async () => {
    await L.openChat(page, base, conv)
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push('tab2: ' + e.message))
    await L.openChat(p2, base, conv)
    const after = await dave.latestSeq(conv)
    await ctx.setOffline(true); await L.sleep(600)
    const bodies = [`${tag} H1`, `${tag} H2`, `${tag} H3`]
    for (const x of bodies) await L.typeAndSend(page, x)
    await L.sleep(1000)
    const tab2Sees = await Promise.all(bodies.map(x => p2.getByText(x, { exact: true }).first().isVisible().catch(() => false)))
    await ctx.setOffline(false)
    const d = await delivered(bodies, after, 60000)
    await L.sleep(3000)
    const all = (await dave.messagesAfter(conv, after)).filter(m => bodies.includes(m.body)).length
    const tab1Copies = await Promise.all(bodies.map(x => page.getByText(x, { exact: true }).count()))
    const tab2Copies = await Promise.all(bodies.map(x => p2.getByText(x, { exact: true }).count()))
    await p2.screenshot({ path: shots('H-tab2') })
    await p2.close()
    return { ok: d.count === 3 && all === 3 && d.inOrder && tab1Copies.every(c => c === 1) && tab2Copies.every(c => c === 1), tab2SeesQueued: tab2Sees, delivery: d, tab1Copies, tab2Copies }
  })

  // I. permanent failure while "online" (server 4xx) shows failed state with retry/discard; and 503 retries automatically
  await run('I-failed-and-retry', async () => {
    await L.openChat(page, base, conv)
    const after = await dave.latestSeq(conv)
    let mode = 503; let calls = 0
    await page.route(`**/api/jm/conversations/${conv}/messages/`, async route => {
      if (route.request().method() !== 'POST') return route.continue()
      calls++
      if (mode) return route.fulfill({ status: mode, contentType: 'application/json', body: JSON.stringify({ detail: mode === 503 ? 'Service unavailable' : 'Rejected by e2e' }) })
      return route.continue()
    })
    const b1 = `${tag} I-503`
    await L.typeAndSend(page, b1); await L.sleep(2500)
    const callsDuring503 = calls
    mode = 0
    const d1 = await delivered([b1], after, 40000)
    mode = 400
    const b2 = `${tag} I-400`
    await L.typeAndSend(page, b2); await L.sleep(2500)
    const failed = await page.getByRole('img', { name: 'Not sent' }).count()
    const retryBtn = await page.getByRole('button', { name: 'Retry queued message' }).count()
    const errText = await page.getByRole('alert').allInnerTexts().catch(() => [])
    await page.screenshot({ path: shots('I-failed') })
    mode = 0
    if (retryBtn) await page.getByRole('button', { name: 'Retry queued message' }).first().click()
    const d2 = await delivered([b2], after, 30000)
    await page.unroute(`**/api/jm/conversations/${conv}/messages/`)
    return { ok: callsDuring503 >= 2 && d1.count === 1 && failed >= 1 && retryBtn >= 1 && d2.count === 1 && d2.duplicates.length === 0, callsDuring503, delivered503: d1, failedBubbles: failed, retryBtn, errText, deliveredAfterRetry: d2 }
  })

  sock.close()
  await L.sleep(300)
  L.save(`${port}-results.json`, { base, conv, tag, at: new Date().toISOString(), pageErrors: errors, results })
  await b.close()
  console.log('pageErrors', errors.length, errors.slice(0, 5))
}
main().catch(e => { console.error('FATAL', e); L.save(`${port}-fatal.txt`, String(e && e.stack || e)); process.exit(1) })
