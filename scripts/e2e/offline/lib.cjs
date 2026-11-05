// Shared helpers for the offline/cache e2e suite. Isolated e2e backend only (127.0.0.1:8010).
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../../..')] }))
const E2E = process.env.JM_E2E_DIR || 'C:/Users/JIVO/AppData/Local/Temp/claude/c--Users-JIVO-Desktop-JM/7b2eb89b-148c-4369-99b4-4677f8853037/scratchpad/e2e'
const acc = JSON.parse(fs.readFileSync(path.join(E2E, 'accounts.json'), 'utf8').replace(/^\uFEFF/, ''))
const BACKEND = 'http://127.0.0.1:8010'
if (!/^http:\/\/127\.0\.0\.1:8010$/.test(BACKEND)) throw Error('refusing non-isolated backend')
const OUT = path.resolve(__dirname, '../../../test-results/e2e/offline')
fs.mkdirSync(OUT, { recursive: true })

class ApiUser {
  constructor(name) { this.name = name; this.who = acc.accounts[name]; this.jar = new Map() }
  keep(r) { for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
  headers(extra = {}) { return { Origin: BACKEND, Referer: BACKEND + '/', Cookie: this.cookie(), 'X-CSRFToken': this.jar.get('jm_csrftoken') || '', ...extra } }
  async login() {
    let r = await fetch(`${BACKEND}/api/jm/auth/csrf/`, { headers: { Origin: BACKEND } }); this.keep(r)
    r = await fetch(`${BACKEND}/api/jm/auth/login/`, { method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ email: this.who.email, password: this.who.password }) })
    this.keep(r); const body = await r.json(); if (r.status !== 200) throw Error(`${this.name} login ${r.status}`)
    return body
  }
  async req(method, url, body) {
    const r = await fetch(`${BACKEND}/api/jm${url}`, { method, headers: this.headers(body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined })
    this.keep(r); const text = await r.text(); let data; try { data = JSON.parse(text) } catch { data = text }
    return { status: r.status, data }
  }
  async messagesAfter(conv, after) {
    const all = []; let cursor = after
    for (let i = 0; i < 20; i++) {
      let res
      for (let k = 0; k < 8; k++) { res = await this.req('GET', `/conversations/${conv}/messages/?after=${cursor}&limit=100`); if (res.status < 500 && res.status !== 429) break; await sleep(1500) }
      const { status, data } = res
      if (status !== 200) throw Error('history ' + status)
      all.push(...data.results); if (!data.has_more_after || !data.results.length) break
      cursor = data.results[data.results.length - 1].seq
    }
    return all
  }
  async latestSeq(conv) { for (let k = 0; k < 8; k++) { const { status, data } = await this.req('GET', `/conversations/${conv}/messages/?limit=1`); if (status === 200) return data.newest_seq ?? 0; await sleep(1500) } throw Error('latestSeq failed') }
  socket() {
    const events = []
    const ws = new WebSocket(BACKEND.replace('http', 'ws') + '/ws/', { headers: { Origin: BACKEND, Cookie: this.cookie() } })
    ws.onmessage = e => { try { events.push({ at: Date.now(), ...JSON.parse(String(e.data)) }) } catch { /* ignore */ } }
    return { ws, events, close: () => { try { ws.close() } catch { /* */ } } }
  }
}

async function browser() { return chromium.launch({ channel: 'msedge', headless: true }) }

async function uiLogin(page, base, name) {
  const who = acc.accounts[name]
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByLabel(/email/i).first().waitFor({ timeout: 120000 })
  await page.getByLabel(/email/i).first().fill(who.email)
  await page.getByLabel(/password/i).first().fill(who.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(u => !/\/login/.test(String(u)), { timeout: 60000 })
}

async function openChat(page, base, conv) {
  await page.goto(`${base}/messenger?conversation=${conv}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await dismissInstall(page)
  await composer(page).waitFor({ timeout: 60000 })
}
async function dismissInstall(page) {
  const btn = page.getByRole('button', { name: 'Not now' })
  for (let i = 0; i < 12; i++) { if (await btn.first().isVisible().catch(() => false)) { await btn.first().click().catch(() => {}); return true } await sleep(500) }
  return false
}
const composer = page => page.getByRole('textbox', { name: 'Message' }).last()
async function typeAndSend(page, text) {
  const box = composer(page); await box.click(); await box.fill(text)
  await page.getByRole('button', { name: 'Send message' }).last().click()
  // composer clears only after durable enqueue
  await page.waitForFunction(() => { const el = [...document.querySelectorAll('textarea,[contenteditable],input')].find(e => (e.getAttribute('aria-label') || '') === 'Message'); return !el || !el.value }, null, { timeout: 15000 })
}
async function idbOutbox(page) {
  return page.evaluate(() => new Promise(resolve => {
    const r = indexedDB.open('jm-universal-outbox'); r.onerror = () => resolve({ error: String(r.error) })
    r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('pending')) { db.close(); resolve([]); return } const g = db.transaction('pending').objectStore('pending').getAll(); g.onsuccess = () => { db.close(); resolve(g.result.filter(x => !x.removed && x.value).map(x => ({ body: x.value.payload.body, status: x.value.status, client: x.value.payload.client_id, attempts: x.value.attempts, media: (x.value.media || []).length }))) } }
  }))
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function until(fn, timeout = 60000, step = 500) { const end = Date.now() + timeout; let last; while (Date.now() < end) { last = await fn(); if (last) return last; await sleep(step) } return last }
function save(name, data) { fs.writeFileSync(path.join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2)) }

module.exports = { dismissInstall, acc, BACKEND, OUT, ApiUser, browser, uiLogin, openChat, composer, typeAndSend, idbOutbox, sleep, until, save }
