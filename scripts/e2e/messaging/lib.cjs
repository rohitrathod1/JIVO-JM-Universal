// Shared helpers for the real-backend messaging e2e (isolated :8010 via :8091 proxy). Synthetic accounts only.
const path = require('path')
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../../..')] }))
const E2E = 'C:/Users/JIVO/AppData/Local/Temp/claude/c--Users-JIVO-Desktop-JM/7b2eb89b-148c-4369-99b4-4677f8853037/scratchpad/e2e'
const acc = require(E2E + '/accounts.json')
const BASE = process.env.JM_E2E_URL || 'http://127.0.0.1:8091/'
const API = 'http://127.0.0.1:8010'
const OUT = path.resolve(__dirname, '../../../test-results/e2e/messaging')
async function login(browser, who, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message))
  page.consoleErrors = []; page.on('console', m => { if (m.type() === 'error') page.consoleErrors.push(m.text()) })
  const a = acc.accounts[who]
  await page.goto(BASE + 'login', { waitUntil: 'domcontentloaded', timeout: 240000 })
  const email = page.getByLabel(/email/i).first(); await email.waitFor({ timeout: 240000 })
  await page.waitForFunction(() => { const i = document.querySelector('input[type=email]'); return i && !i.readOnly }, null, { timeout: 120000 })
  await email.fill(a.email); await page.getByLabel(/password/i).first().fill(a.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  try { await page.getByText('E2E Team').first().waitFor({ timeout: 150000 }) }
  catch (e) { await page.screenshot({ path: OUT + '/login-fail-' + who + '.png' }).catch(() => {}); throw Error('login ' + who + ' did not reach chat list: ' + (await page.locator('body').innerText().catch(() => '')).slice(0, 400)) }
  // dismiss install prompt if any
  for (const n of [/not now/i, /dismiss/i]) { const b = page.getByRole('button', { name: n }); if (await b.count()) await b.first().click().catch(() => {}) }
  return { ctx, page }
}
// Minimal API client (direct to 8010) for checks and setup; cookie jar per user.
async function api(who) {
  const jar = {}
  const hdr = () => ({ Origin: API, Cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '), 'X-CSRFToken': jar.jm_csrftoken || '' })
  const store = r => { for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1) } }
  const req = async (method, p, body) => { const r = await fetch(API + p, { method, headers: { ...hdr(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); store(r); let j = null; const t = await r.text(); try { j = JSON.parse(t) } catch { j = t }; return { status: r.status, body: j } }
  await req('GET', '/api/jm/auth/csrf/')
  const a = acc.accounts[who]
  const l = await req('POST', '/api/jm/auth/login/', { email: a.email, password: a.password })
  if (l.status !== 200) throw Error('api login ' + who + ' ' + l.status)
  return { req, jar }
}
module.exports = { chromium, acc, BASE, API, OUT, login, api, E2E }
