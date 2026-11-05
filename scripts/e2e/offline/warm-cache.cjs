// Warm offline cache + cold-start recovery. Usage: node scripts/e2e/offline/warm-cache.cjs [base=http://127.0.0.1:4176]
// J: open chat X online, open chat Y, go offline, reopen X -> recently synchronized history expected (memory cache).
// K: cold start offline (PWA shell) -> then go online WITHOUT user action -> does the app recover by itself and flush the queue?
const L = require('./lib.cjs')
const base = (process.argv[2] || 'http://127.0.0.1:4176').replace(/\/$/, '')
if (!/^http:\/\/127\.0\.0\.1:(8091|4176)$/.test(base)) throw Error('only the e2e proxies are allowed')
const port = new URL(base).port
const tag = `WARM${port}-${Date.now().toString(36)}`
;(async () => {
  const out = {}
  const dave = new L.ApiUser('dave'); await dave.login()
  const conv = (await dave.req('POST', '/conversations/direct/', { user_id: L.acc.accounts.carol.public_id })).data.id
  const group = L.acc.conversations.group_e2e_team.public_id
  const b = await L.browser(); const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'allow' })
  const errors = []; let page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message))
  await L.uiLogin(page, base, 'carol')
  await L.openChat(page, base, conv)
  const seed = `${tag} seed`; await L.typeAndSend(page, seed)
  await L.until(async () => (await L.idbOutbox(page)).length === 0, 20000)
  // switch in-app (client-side) to the group, then offline, then back to the direct chat
  await page.getByText('E2E Team').first().click(); await L.sleep(3000)
  await page.context().setOffline(true); await L.sleep(800)
  await page.getByText('Dave E2E').first().click(); await L.sleep(4000)
  out.J = {
    cachedNotice: await page.getByText('Offline: showing recently synchronized messages.').first().isVisible().catch(() => false),
    seedVisible: await page.getByText(seed, { exact: true }).first().isVisible().catch(() => false),
    composerVisible: await L.composer(page).isVisible().catch(() => false),
  }
  await page.screenshot({ path: `${L.OUT}/${port}-J-warm-offline.png` })
  // K: cold start offline with a queued message
  const body = `${tag} K1`; const after = await dave.latestSeq(conv)
  if (out.J.composerVisible) { try { await L.typeAndSend(page, body); out.K_enqueued = true } catch (e) { out.K_enqueued = String(e.message).split('\n')[0] } }
  out.K_idb = await L.idbOutbox(page)
  let reload = 'ok'; try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }) } catch (e) { reload = String(e.message).split('\n')[0] }
  await L.sleep(6000)
  out.K_reload = reload
  out.K_offlineText = (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 400)
  await page.screenshot({ path: `${L.OUT}/${port}-K-cold-offline.png` })
  await ctx.setOffline(false)
  const t0 = Date.now()
  const auto = await L.until(async () => (await dave.messagesAfter(conv, after)).some(m => m.body === body), 45000, 1000)
  out.K_autoRecoveredWithin45s = Boolean(auto); out.K_autoMs = auto ? Date.now() - t0 : null
  out.K_onlineText = (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 400)
  await page.screenshot({ path: `${L.OUT}/${port}-K-online-no-action.png` })
  if (!auto) {
    // user path: Retry connection -> Retry
    try {
      await page.getByRole('button', { name: 'Retry connection' }).click({ timeout: 5000 })
      await page.getByRole('button', { name: 'Retry' }).last().click({ timeout: 5000 })
      const ok = await L.until(async () => (await dave.messagesAfter(conv, after)).some(m => m.body === body), 45000, 1000)
      out.K_afterManualRetry = Boolean(ok)
    } catch (e) { out.K_afterManualRetry = 'error: ' + String(e.message).split('\n')[0] }
  }
  out.K_copies = (await dave.messagesAfter(conv, after)).filter(m => m.body === body).length
  out.pageErrors = errors
  L.save(`${port}-warm-cache.json`, out); console.log(JSON.stringify(out, null, 1))
  await b.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
