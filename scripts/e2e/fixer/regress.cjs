// Fixer regression checks for the 04/05-Nov-2026 full E2E defects. Isolated stack only (4176 -> 8010).
// Usage: node scripts/e2e/fixer/regress.cjs [base=http://127.0.0.1:4176]
const fs = require('node:fs')
const path = require('node:path')
const L = require('../offline/lib.cjs')
const base = (process.argv[2] || 'http://127.0.0.1:4176').replace(/\/$/, '')
if (!/^http:\/\/127\.0\.0\.1:(8091|4176)$/.test(base)) throw Error('only the e2e proxies are allowed')
const OUT = path.resolve(__dirname, '../../../test-results/e2e/fixer')
fs.mkdirSync(OUT, { recursive: true })
const tag = `FIX-${Date.now().toString(36)}`
const conv = L.acc.conversations.direct_alice_bob.public_id
const results = []
const check = (name, pass, detail) => { results.push({ name, result: pass ? 'PASS' : 'FAIL', detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail ?? '') }

;(async () => {
  const bobApi = new L.ApiUser('bob'); await bobApi.login()
  const start = await bobApi.latestSeq(conv)
  const b = await L.browser()
  const errors = []
  const ctxA = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const ctxB = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const a = await ctxA.newPage(); a.on('pageerror', e => errors.push('alice: ' + e.message))
  const bp = await ctxB.newPage(); bp.on('pageerror', e => errors.push('bob: ' + e.message))
  try {
    await L.uiLogin(a, base, 'alice'); await L.dismissInstall(a)
    // M-03: selecting a chat puts it in the URL; reload reopens it.
    await a.getByRole('button', { name: /Open Bob E2E/ }).first().click({ timeout: 60000 })
    await L.composer(a).waitFor({ timeout: 60000 })
    const url = a.url()
    check('M-03 open chat is in the URL', url.includes(`conversation=${conv}`), url)
    await a.reload({ waitUntil: 'domcontentloaded' }); await L.dismissInstall(a)
    const reopened = await L.composer(a).waitFor({ timeout: 60000 }).then(() => true, () => false)
    check('M-03 reload reopens the chat', reopened)

    // M-02: Enter sends, Shift+Enter adds a newline.
    const box = L.composer(a); await box.click(); await box.fill(`${tag} shift`); await box.press('Shift+Enter')
    const shiftValue = await box.inputValue()
    check('M-02 Shift+Enter adds a newline', shiftValue.endsWith('\n'), JSON.stringify(shiftValue))
    await box.fill(`${tag} enter`); await box.press('Enter')
    const cleared = await L.until(async () => (await box.inputValue()) === '', 15000)
    const got = await L.until(async () => (await bobApi.messagesAfter(conv, start)).filter(m => m.body === `${tag} enter`).length, 60000, 1500)
    check('M-02 Enter sends on desktop web', !!cleared && got === 1, `composer cleared=${!!cleared}, server copies=${got}`)

    // M-05: typing indicator clears after the sender empties the composer.
    await L.uiLogin(bp, base, 'bob'); await L.openChat(bp, base, conv)
    await box.click(); await box.pressSequentially('typing probe', { delay: 60 })
    const seen = await L.until(async () => (await bp.getByText('typing…').count()) > 0, 10000)
    await box.fill('')
    await L.sleep(7000)
    const after = await bp.getByText('typing…').count()
    check('M-05 typing indicator clears after the composer is emptied', after === 0, `seen=${!!seen}, visible after 7 s=${after}`)

    // M-04: Escape closes the conversation search dialog.
    await a.getByRole('button', { name: 'Conversation options' }).first().click()
    await a.getByRole('menuitem', { name: /Search/ }).first().click().catch(async () => a.getByRole('button', { name: /^Search/ }).first().click())
    const searchField = a.getByLabel('Search messages', { exact: true })
    await searchField.waitFor({ timeout: 15000 })
    await a.keyboard.press('Escape')
    const closed = await L.until(async () => !(await searchField.isVisible().catch(() => false)), 5000)
    check('M-04 Escape closes conversation search', !!closed)

    // STATIC-2 / OFF-03: offline send shows the status line, Discard and the offline banner; delivered once online.
    await ctxA.setOffline(true)
    await box.click(); await box.fill(`${tag} offline`); await a.getByRole('button', { name: 'Send message' }).last().click()
    const line = await a.getByText('Waiting for network · sends automatically', { exact: true }).first().waitFor({ timeout: 15000 }).then(() => true, () => false)
    const discard = await a.getByRole('button', { name: 'Discard queued message' }).first().isVisible().catch(() => false)
    const banner = await L.until(async () => (await a.getByText('Offline. Messages will send when connected.').count()) > 0, 15000)
    await a.screenshot({ path: path.join(OUT, 'offline-queued-1440.png') })
    check('STATIC-2 queued message shows status line and Discard', line && discard, `line=${line}, discard=${discard}`)
    check('OFF-03 offline banner says messages will send', !!banner)
    await ctxA.setOffline(false)
    const offlineCopies = await L.until(async () => (await bobApi.messagesAfter(conv, start)).filter(m => m.body === `${tag} offline`).length, 90000, 2000)
    check('Offline message delivered once after reconnect', offlineCopies === 1, `copies=${offlineCopies}`)

    // M-01 client side: image tiles never render as a blank box (image or "preview unavailable" icon).
    const tiles = a.getByRole('button', { name: /^View image / })
    const tileCount = await tiles.count()
    let blank = 0
    for (let i = 0; i < tileCount; i++) {
      const t = tiles.nth(i)
      const hasImg = await t.locator('img').count(); const fallback = await t.getByRole('img', { name: /preview unavailable/ }).count()
      if (!hasImg && !fallback) blank++
    }
    check('M-01 (client) image tiles show an image or a fallback icon', blank === 0, `tiles=${tileCount}, blank=${blank}`)

    // DEF-009: non-admin /admin page has a styled state with a way back.
    await a.goto(base + '/admin', { waitUntil: 'domcontentloaded' })
    const back = await a.getByRole('button', { name: 'Back to home' }).waitFor({ timeout: 30000 }).then(() => true, () => false)
    await a.screenshot({ path: path.join(OUT, 'admin-denied-1280.png') })
    check('DEF-009 admin permission state has a way back', back)
  } catch (e) {
    check('script error', false, String(e && e.message || e).slice(0, 400))
    await a.screenshot({ path: path.join(OUT, 'regress-error.png') }).catch(() => {})
  } finally {
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    fs.writeFileSync(path.join(OUT, 'regress.json'), JSON.stringify({ base, tag, results }, null, 2))
    await b.close()
  }
})()
