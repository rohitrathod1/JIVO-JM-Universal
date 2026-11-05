// Responsive + UI/UX sweep against the isolated E2E stack (never the dev backend on 8000).
// Usage: node scripts/e2e/responsive/sweep.cjs [base=http://127.0.0.1:4176] [users=alice,admin]
// Signs in through the proxied API (CSRF -> login) with the synthetic accounts in the E2E scratchpad,
// opens every screen, resizes through the width/height matrix in light and dark and records:
// page overflow, off-screen text, clipped text, overlapping text, small touch targets (phones),
// unnamed controls, low-contrast text, page errors; screenshots + aria snapshots per route.
const { chromium } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')
const ACC = process.env.JM_E2E_ACCOUNTS || 'C:/Users/JIVO/AppData/Local/Temp/claude/c--Users-JIVO-Desktop-JM/7b2eb89b-148c-4369-99b4-4677f8853037/scratchpad/e2e/accounts.json'
const acc = JSON.parse(fs.readFileSync(ACC, 'utf8').replace(/^\uFEFF/, ''))
const base = (process.argv[2] || 'http://127.0.0.1:4176').replace(/\/$/, '')
if (!/^http:\/\/127\.0\.0\.1:(4176|8091)$/.test(base)) throw new Error('refusing non-E2E base ' + base)
const users = (process.argv[3] || 'alice,admin').split(',')
const out = path.resolve(__dirname, '../../../test-results/e2e/responsive')
fs.mkdirSync(path.join(out, 'shots'), { recursive: true }); fs.mkdirSync(path.join(out, 'aria'), { recursive: true })
const WIDTHS = (process.env.WIDTHS || '320,360,390,414,768,1024,1280,1440,1920').split(',').map(Number)
const THEMES = (process.env.THEMES || 'light,dark').split(',')
const direct = acc.conversations.direct_alice_bob.public_id, group = acc.conversations.group_e2e_team.public_id
const ROUTES = {
  alice: [['home', '/home'], ['chatlist', '/messenger'], ['chat-direct', `/messenger?conversation=${direct}`], ['chat-group', `/messenger?conversation=${group}`],
    ['group-info', `/group-info?conversation=${group}`], ['contact-info', `/group-info?conversation=${direct}`], ['profile', '/profile'], ['notifications', '/notifications'],
    ['alerts', '/alerts'], ['passwords', '/passwords'], ['tools', '/tools'], ['approvals', '/approvals'], ['admin', '/admin'], ['bad-chat', '/messenger?conversation=00000000-0000-0000-0000-000000000000']],
  admin: [['home', '/home'], ['chatlist', '/messenger'], ['profile', '/profile'], ['notifications', '/notifications'], ['passwords', '/passwords'], ['tools', '/tools'], ['approvals', '/approvals'], ['admin', '/admin']],
}
if (process.env.ROUTES) for (const u of Object.keys(ROUTES)) ROUTES[u] = ROUTES[u].filter(r => process.env.ROUTES.split(',').includes(r[0]))

async function signIn(context, who) {
  const origin = base, a = acc.accounts[who]
  let r = await context.request.get(`${base}/api/jm/auth/csrf/`, { headers: { Origin: origin } })
  const csrf = (await context.cookies(base)).find(c => c.name === 'jm_csrftoken')?.value
  r = await context.request.post(`${base}/api/jm/auth/login/`, { headers: { Origin: origin, Referer: origin + '/', 'X-CSRFToken': csrf, 'Content-Type': 'application/json' }, data: { email: a.email, password: a.password } })
  if (!r.ok()) throw new Error(`login ${who} ${r.status()} ${(await r.text()).slice(0, 200)}`)
}

// Runs in the page. Returns problems found at the current viewport.
function audit(phone) {
  const W = innerWidth, H = innerHeight
  const vis = el => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const desc = el => { const t = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 50); return `${el.tagName.toLowerCase()}${el.getAttribute('role') ? '[' + el.getAttribute('role') + ']' : ''}${el.dataset.testid ? '#' + el.dataset.testid : ''} "${t}"` }
  const hiddenByAncestor = el => { for (let p = el.parentElement; p; p = p.parentElement) { if (p.getAttribute('aria-hidden') === 'true') return true; const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return true } return false }
  const scrollsX = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true; if (s.overflowX === 'hidden' || s.overflowX === 'clip') { const r = p.getBoundingClientRect(); if (r.right <= W + 1 && r.left >= -1) return 'clipped' } } return false }
  const res = { overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - W, offscreen: [], clipped: [], overlap: [], small: [], unnamed: [], contrast: [], bg: getComputedStyle(document.body).backgroundColor }
  // leaf text elements
  const leaves = [...document.querySelectorAll('body *')].filter(el => !['SCRIPT', 'STYLE', 'svg', 'path', 'NOSCRIPT'].includes(el.tagName) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && vis(el) && !hiddenByAncestor(el))
  const rects = []
  for (const el of leaves) {
    const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > H) continue
    if (r.right > W + 2 || r.left < -2) { if (!scrollsX(el)) res.offscreen.push(`${desc(el)} x=${Math.round(r.left)}..${Math.round(r.right)}`) }
    const s = getComputedStyle(el)
    if (el.scrollWidth > el.clientWidth + 2 && s.textOverflow !== 'ellipsis' && (s.overflow === 'hidden' || s.overflowX === 'hidden') && !el.closest('input,textarea')) res.clipped.push(`${desc(el)} sw=${el.scrollWidth} cw=${el.clientWidth}`)
    if (el.scrollHeight > el.clientHeight + 3 && (s.overflowY === 'hidden') && !s.webkitLineClamp?.match(/\d/) && s.textOverflow !== 'ellipsis' && el.clientHeight > 0) res.clipped.push(`${desc(el)} (vertical) sh=${el.scrollHeight} ch=${el.clientHeight}`)
    // range rect of the actual text
    const range = document.createRange(); const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); range.selectNodeContents(tn); const tr = range.getBoundingClientRect()
    if (tr.width > 0) rects.push({ el, r: tr })
    // contrast
    const fg = s.color.match(/[\d.]+/g).map(Number); let bg = null
    for (let p = el; p; p = p.parentElement) { const c = getComputedStyle(p).backgroundColor.match(/[\d.]+/g)?.map(Number); if (c && (c.length < 4 || c[3] > 0.9)) { bg = c; break } if (getComputedStyle(p).backgroundImage !== 'none') { bg = 'img'; break } }
    if (bg && bg !== 'img' && (fg.length < 4 || fg[3] > 0.5)) {
      const L = c => { const [R, G, B] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * R + 0.7152 * G + 0.0722 * B }
      const a = fg.length > 3 ? fg[3] : 1; const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a))
      const ratio = (Math.max(L(mix), L(bg)) + 0.05) / (Math.min(L(mix), L(bg)) + 0.05)
      const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 700, large = size >= 24 || (bold && size >= 18.66)
      const disabled = el.closest('[aria-disabled="true"],[disabled]')
      if (!disabled && ratio < (large ? 3 : 4.5)) res.contrast.push(`${desc(el)} ${ratio.toFixed(2)}:1 ${s.color} on rgb(${bg.slice(0, 3)}) ${size}px`)
    }
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue
    const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
    if (ix > 4 && iy > 4) {
      // only count if both are actually painted on top (not under a modal)
      const top = (r, el) => { const e = document.elementFromPoint(Math.min(W - 1, Math.max(0, r.left + ix / 2)), Math.min(H - 1, Math.max(0, (Math.max(a.r.top, b.r.top) + iy / 2)))); return e && (e === el || el.contains(e) || e.contains(el)) }
      if (top(a.r, a.el) && top(b.r, b.el)) res.overlap.push(`${desc(a.el)} <> ${desc(b.el)}`)
    }
  }
  const inter = [...document.querySelectorAll('a[href],button,input,textarea,select,[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=menuitem],[role=radio],[tabindex="0"]')].filter(el => vis(el) && !hiddenByAncestor(el))
  for (const el of inter) {
    const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue
    if (phone && (r.width < 44 || r.height < 44) && !el.closest('[role=dialog] [role=presentation]')) { if (!(el.tagName === 'INPUT' && r.height >= 40)) res.small.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`) }
    const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || (el.id && document.querySelector(`label[for="${el.id}"]`)?.innerText) || el.querySelector('img[alt]')?.alt || '').trim()
    if (!name) res.unnamed.push(desc(el) + ` @${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`)
  }
  for (const k of ['offscreen', 'clipped', 'overlap', 'small', 'unnamed', 'contrast']) res[k] = [...new Set(res[k])]
  return res
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const results = []; const CACHES = {}
  const t0 = Date.now()
  try {
    // signed-out login screen
    const jobs = [['signed-out', [['login', '/login']]], ...users.map(u => [u, ROUTES[u]])]
    for (const [who, routes] of jobs) for (const theme of THEMES) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, serviceWorkers: 'block', hasTouch: false })
      // The PWA install invitation is checked separately (install-prompt.cjs); dismiss it here so it does not mask screens.
      await context.addInitScript(() => { try { localStorage.setItem('jm.install.dismissedAt', String(Date.now())) } catch {} })
      if (who !== 'signed-out') await signIn(context, who)
      // The shared E2E backend is under parallel load tests; cache GET API responses per user so each URL hits it once.
      const cache = (CACHES[who] ||= new Map())
      await context.route('**/api/jm/**', async route => {
        const req = route.request(); if (req.method() !== 'GET') return route.continue()
        const key = req.url(); const hit = cache.get(key)
        if (hit) return route.fulfill(hit)
        try { const res = await route.fetch({ timeout: 90000 }); const v = { status: res.status(), headers: res.headers(), body: await res.body() }; if (res.status() < 500) cache.set(key, v); return route.fulfill(v) } catch { return route.abort().catch(() => {}) }
      })
      const page = await context.newPage(); const errors = []; const consoleErr = []
      page.on('pageerror', e => errors.push(e.message.slice(0, 200)))
      page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 200)) })
      for (const [name, url] of routes) {
        errors.length = 0; consoleErr.length = 0
        const t = Date.now()
        await page.setViewportSize({ width: 390, height: 900 })
        for (let attempt = 0; attempt < 4; attempt++) { const ok = await page.goto(base + url, { waitUntil: 'load', timeout: 60000 }).then(() => true, e => { if (attempt === 3) errors.push('goto: ' + e.message.slice(0, 120)); return false }); if (ok) break; await page.waitForTimeout(15000) }
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); await page.waitForFunction(() => !document.querySelector('[role=progressbar]') && document.body.innerText.trim().length > 20, null, { timeout: 60000 }).catch(() => errors.push('still loading after 60s')); await page.waitForTimeout(1500)
        const loadMs = Date.now() - t
        const landed = new URL(page.url()); const landedPath = landed.pathname + landed.search
        try { fs.writeFileSync(path.join(out, 'aria', `${who}-${name}-${theme}-390.yml`), await page.locator('body').ariaSnapshot({ timeout: 10000 })) } catch (e) { }
        for (const width of WIDTHS) for (const height of (width <= 414 ? [640, 900] : [900])) {
          await page.setViewportSize({ width, height }); await page.waitForTimeout(350)
          const a = await page.evaluate(audit, width <= 414)
          const shot = path.join('shots', `${who}-${name}-${theme}-${width}x${height}.png`)
          await page.screenshot({ path: path.join(out, shot) }).catch(() => {})
          results.push({ who, route: name, url, landedPath, theme, width, height, loadMs, shot, errors: [...errors], consoleErr: [...new Set(consoleErr)].slice(0, 5), ...a })
        }
        console.log(who, theme, name, '->', landedPath, loadMs + 'ms', 'errors', errors.length)
      }
      await context.close()
    }
  } finally {
    await browser.close()
    fs.writeFileSync(path.join(out, `sweep${process.env.TAG || ''}.json`), JSON.stringify({ base, at: new Date().toISOString(), secs: (Date.now() - t0) / 1000, results }, null, 1))
    // summary
    const sum = {}
    for (const r of results) for (const k of ['offscreen', 'clipped', 'overlap', 'small', 'unnamed', 'contrast']) for (const item of r[k]) { const key = `${r.who}|${r.route}|${k}|${item.replace(/ x=-?\d+\.\.\d+| sw=\d+ cw=\d+| sh=\d+ ch=\d+| @-?\d+,-?\d+/g, '')}`; (sum[key] ||= []).push(`${r.theme}-${r.width}x${r.height}`) }
    const over = results.filter(r => r.overflow > 1).map(r => `${r.who}|${r.route}|${r.theme}|${r.width}x${r.height}|+${r.overflow}px`)
    fs.writeFileSync(path.join(out, `summary${process.env.TAG || ''}.json`), JSON.stringify({ overflow: over, errors: results.filter(r => r.errors.length).map(r => `${r.who}|${r.route}|${r.theme}: ${r.errors.join(' / ')}`).filter((v, i, a) => a.indexOf(v) === i), issues: sum }, null, 1))
    console.log('overflow', over.length, 'issue keys', Object.keys(sum).length)
  }
})().catch(e => { console.error(e); process.exitCode = 1 })
