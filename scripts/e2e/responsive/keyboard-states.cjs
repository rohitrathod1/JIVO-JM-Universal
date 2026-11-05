// Keyboard navigation, visible focus, install prompt, empty/error/offline states and safe-area wiring.
// Usage: node scripts/e2e/responsive/keyboard-states.cjs [base=http://127.0.0.1:4176] [user=alice]
const { chromium } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')
const ACC = process.env.JM_E2E_ACCOUNTS || 'C:/Users/JIVO/AppData/Local/Temp/claude/c--Users-JIVO-Desktop-JM/7b2eb89b-148c-4369-99b4-4677f8853037/scratchpad/e2e/accounts.json'
const acc = JSON.parse(fs.readFileSync(ACC, 'utf8').replace(/^\uFEFF/, ''))
const base = (process.argv[2] || 'http://127.0.0.1:4176').replace(/\/$/, '')
if (!/^http:\/\/127\.0\.0\.1:(4176|8091)$/.test(base)) throw new Error('refusing non-E2E base ' + base)
const who = acc.accounts[process.argv[3] || 'alice']
const out = path.resolve(__dirname, '../../../test-results/e2e/responsive/keyboard')
fs.mkdirSync(out, { recursive: true })
const report = {}

const focusInfo = () => {
  const el = document.activeElement; if (!el || el === document.body) return { tag: 'body' }
  const s = getComputedStyle(el); const r = el.getBoundingClientRect()
  const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
  const visible = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none')
  return { tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), name, visibleFocus: !!visible, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
}
async function tabWalk(page, n, label) {
  const steps = []
  for (let i = 0; i < n; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(80); steps.push(await page.evaluate(focusInfo)) }
  report[label] = steps
  return steps
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    // 1. Install prompt behaviour (fresh profile, no dismissal stored) + login keyboard walk
    let context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
    let page = await context.newPage(); const g = page.goto.bind(page); page.goto = async (u, o) => { const r = await g(u, { timeout: 90000, ...o }); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); return r }; const rl = page.reload.bind(page); page.reload = async o => { const r = await rl(o); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); return r }; const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto(base + '/login', { waitUntil: 'load' })
    const meta = await page.evaluate(() => ({ viewport: document.querySelector('meta[name=viewport]')?.content, safeAreaCss: [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => r.cssText.includes('safe-area-inset')) } catch { return false } }) || document.documentElement.outerHTML.includes('safe-area-inset'), lang: document.documentElement.lang, title: document.title }))
    report.meta = meta
    await tabWalk(page, 10, 'login-tab-order')
    await page.screenshot({ path: path.join(out, 'login-focus-1280.png') })
    // keyboard-only sign-in
    await page.getByLabel(/email/i).first().focus(); await page.keyboard.type(who.email); await page.keyboard.press('Tab')
    report.afterEmailTab = await page.evaluate(focusInfo)
    await page.getByLabel(/password/i).first().focus(); await page.keyboard.type(who.password); await page.keyboard.press('Enter')
    const signedInByEnter = await page.waitForURL(u => !/\/login/.test(u.pathname), { timeout: 20000 }).then(() => true).catch(() => false)
    report.enterSubmitsLogin = signedInByEnter
    if (!signedInByEnter) { await page.getByRole('button', { name: /^sign in$/i }).click(); await page.waitForURL(u => !/\/login/.test(u.pathname), { timeout: 20000 }) }
    await page.goto(base + '/messenger', { waitUntil: 'load' })
    const dlg = page.getByText('Install JIVO JM')
    report.installPromptShown = await dlg.waitFor({ timeout: 9000 }).then(() => true).catch(() => false)
    if (report.installPromptShown) {
      await page.screenshot({ path: path.join(out, 'install-prompt-1280.png') })
      report.installPromptFocus = await page.evaluate(focusInfo)
      report.installPromptRole = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],[aria-modal=true]')].map(e => e.getAttribute('role') + '/' + e.getAttribute('aria-modal') + '/' + (e.getAttribute('aria-label') || '')))
      await tabWalk(page, 6, 'install-prompt-tabs')
      await page.keyboard.press('Escape'); await page.waitForTimeout(500)
      report.installPromptClosedByEscape = !(await dlg.isVisible())
      if (!report.installPromptClosedByEscape) await page.getByRole('button', { name: 'Not now' }).click()
      await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(6000)
      report.installPromptReappearsAfterDismiss = await dlg.isVisible()
    }
    // 2. Signed-in tab walk on chat list (desktop)
    await page.goto(base + '/messenger', { waitUntil: 'load' }); await page.waitForTimeout(1000)
    await tabWalk(page, 25, 'messenger-tab-order-1280')
    await page.screenshot({ path: path.join(out, 'messenger-focus-1280.png') })
    // Open a chat with keyboard: focus the row and press Enter
    const row = page.getByText('Bob E2E', { exact: true }).first()
    await row.focus().catch(() => {})
    const rowFocusable = await page.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? (a.getAttribute('role') || a.tagName) + ' ' + (a.getAttribute('aria-label') || a.innerText || '').slice(0, 40) : 'body' })
    report.chatRowFocus = rowFocusable
    // tab until we reach a row containing Bob
    await page.locator('body').click({ position: { x: 5, y: 890 } }).catch(() => {})
    let opened = false
    for (let i = 0; i < 40 && !opened; i++) {
      await page.keyboard.press('Tab'); const f = await page.evaluate(focusInfo)
      if (/Bob E2E/.test(f.name)) { await page.keyboard.press('Enter'); await page.waitForTimeout(1500); opened = /conversation=/.test(page.url()) ; report.chatOpenedByKeyboard = { opened, after: i + 1, url: page.url().replace(base, '') } }
    }
    if (!opened) report.chatOpenedByKeyboard = { opened: false }
    await page.goto(base + '/messenger?conversation=' + acc.conversations.direct_alice_bob.public_id, { waitUntil: 'load' }); await page.waitForTimeout(1500)
    report.composerAutofocus = await page.evaluate(focusInfo)
    await tabWalk(page, 15, 'chat-tab-order-1280')
    await page.screenshot({ path: path.join(out, 'chat-focus-1280.png') })
    // Escape behaviour on conversation options menu
    const opts = page.getByRole('button', { name: 'Conversation options' })
    if (await opts.count()) { await opts.first().click(); await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, 'chat-options-open.png') }); report.optionsMenuFocus = await page.evaluate(focusInfo); await page.keyboard.press('Escape'); await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, 'chat-options-after-escape.png') }) }
    // 3. Empty search state (phone)
    await page.setViewportSize({ width: 360, height: 640 })
    await page.goto(base + '/messenger', { waitUntil: 'load' }); await page.waitForTimeout(800)
    const search = page.getByPlaceholder(/search/i).first()
    if (await search.count()) { await search.fill('zzqqxx-no-such-chat'); await page.waitForTimeout(1500); report.emptySearchText = (await page.locator('body').innerText()).slice(0, 600); await page.screenshot({ path: path.join(out, 'empty-search-360.png') }) }
    // 4. Offline state in an open chat (phone)
    await page.goto(base + '/messenger?conversation=' + acc.conversations.group_e2e_team.public_id, { waitUntil: 'load' }); await page.waitForTimeout(1000)
    await context.setOffline(true); await page.waitForTimeout(6000)
    report.offlineText = (await page.locator('body').innerText()).split('\n').filter(l => /offline|connect|reconnect|network|internet/i.test(l)).slice(0, 5)
    await page.screenshot({ path: path.join(out, 'offline-chat-360.png') })
    await context.setOffline(false); await page.waitForTimeout(6000)
    report.backOnlineText = (await page.locator('body').innerText()).split('\n').filter(l => /offline|connect|reconnect|network|internet/i.test(l)).slice(0, 5)
    await page.screenshot({ path: path.join(out, 'back-online-chat-360.png') })
    // 5. Error state: unknown conversation and unknown route
    await page.goto(base + '/messenger?conversation=00000000-0000-0000-0000-000000000000', { waitUntil: 'load' }); await page.waitForTimeout(2000)
    report.badConversationText = (await page.locator('body').innerText()).slice(0, 400); await page.screenshot({ path: path.join(out, 'bad-conversation-360.png') })
    await page.goto(base + '/no-such-page', { waitUntil: 'load' }); await page.waitForTimeout(1500)
    report.unknownRoute = { url: page.url().replace(base, ''), text: (await page.locator('body').innerText()).slice(0, 300) }; await page.screenshot({ path: path.join(out, 'unknown-route-360.png') })
    // 6. Loading state: slow API
    await context.route('**/api/jm/conversations/**', async r => { await new Promise(res => setTimeout(res, 4000)); await r.continue().catch(() => {}) })
    await page.goto(base + '/messenger', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
    report.loadingText = (await page.locator('body').innerText()).slice(0, 300)
    report.loadingHasBusy = await page.evaluate(() => document.querySelectorAll('[aria-busy=true],[role=progressbar]').length)
    await page.screenshot({ path: path.join(out, 'loading-chatlist-360.png') })
    await context.unroute('**/api/jm/conversations/**')
    // 7. API error state: conversations 500
    await context.route('**/api/jm/conversations/', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' }))
    await page.goto(base + '/messenger', { waitUntil: 'load' }); await page.waitForTimeout(2000)
    report.errorText = (await page.locator('body').innerText()).slice(0, 400)
    await page.screenshot({ path: path.join(out, 'error-chatlist-360.png') })
    report.pageErrors = errors
    await context.close()
  } finally {
    await browser.close()
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1))
    console.log(JSON.stringify(report, null, 1).slice(0, 12000))
  }
})().catch(e => { console.error(e); process.exitCode = 1 })
