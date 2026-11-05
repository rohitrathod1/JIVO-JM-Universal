// Usage: node scripts/e2e/security/api-security.mjs <accounts.json>
// Safe dynamic checks against the ISOLATED backend http://127.0.0.1:8010 only (synthetic users).
// Prints no cookies, tokens or passwords.
import fs from 'node:fs'
import path from 'node:path'
const BASE = 'http://127.0.0.1:8010'
if (!BASE.includes(':8010')) throw Error('isolated backend only')
const acc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''))
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../../test-results/e2e/security/api-security.json')
const results = []
const check = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(detail)) }
class Client {
  constructor(origin = BASE) { this.jar = new Map(); this.origin = origin; this.setCookies = [] }
  keep(r) { for (const c of r.headers.getSetCookie()) { this.setCookies.push(c.replace(/=[^;]*/, '=<redacted>')); const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
  async req(method, p, { body, headers = {}, csrf = true, origin = this.origin } = {}) {
    const h = { Cookie: this.cookie(), ...(origin ? { Origin: origin, Referer: origin + '/' } : {}), ...headers }
    if (body !== undefined) h['Content-Type'] = 'application/json'
    if (csrf && method !== 'GET' && this.jar.get('jm_csrftoken')) h['X-CSRFToken'] = this.jar.get('jm_csrftoken')
    const r = await fetch(BASE + '/api/jm' + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
    this.keep(r); let data = null; try { data = await r.json() } catch {}
    return { status: r.status, data, headers: r.headers }
  }
  async login(who) { await this.req('GET', '/auth/csrf/'); const r = await this.req('POST', '/auth/login/', { body: { email: who.email, password: who.password } }); return r }
}
const A = acc.accounts
const conv = acc.conversations
// 1. Cookie flags
const alice = new Client(); const lr = await alice.login(A.alice)
check('login works (alice)', lr.status === 200, { status: lr.status })
const flags = alice.setCookies.map(c => ({ name: c.split('=')[0], httpOnly: /httponly/i.test(c), sameSite: (c.match(/samesite=(\w+)/i) || [])[1] || null, secure: /;\s*secure/i.test(c) }))
const sess = flags.filter(f => !/csrf/i.test(f.name))
check('session cookie is HttpOnly + SameSite', sess.length > 0 && sess.every(f => f.httpOnly && f.sameSite), { flags })
// 2. CSRF: POST without token
const noTok = await alice.req('POST', `/conversations/${conv.direct_alice_bob.public_id}/read/`, { body: { seq: 1 }, csrf: false })
check('POST without X-CSRFToken refused', noTok.status === 403, { status: noTok.status })
// 3. CSRF: foreign Origin with valid token
const evil = await alice.req('POST', `/conversations/${conv.direct_alice_bob.public_id}/read/`, { body: { seq: 1 }, origin: 'https://evil.example' })
check('POST from foreign Origin refused', evil.status === 403, { status: evil.status })
// 4. CORS preflight from foreign origin
const pre = await fetch(BASE + '/api/jm/me/', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-csrftoken' } })
const acao = pre.headers.get('access-control-allow-origin'); const acac = pre.headers.get('access-control-allow-credentials')
check('CORS does not allow foreign origin with credentials', !(acao === 'https://evil.example' || acao === '*') , { status: pre.status, acao, acac })
const getEvil = await fetch(BASE + '/api/jm/me/', { headers: { Origin: 'https://evil.example', Cookie: alice.cookie() } })
check('credentialed GET /me from foreign origin has no ACAO', !getEvil.headers.get('access-control-allow-origin'), { status: getEvil.status, acao: getEvil.headers.get('access-control-allow-origin') })
// 5. Security headers on /api and cache-control on authenticated responses
const me = await alice.req('GET', '/me/')
const cc = me.headers.get('cache-control') || ''
check('authenticated /me not publicly cacheable', /no-store|private/i.test(cc), { cacheControl: cc, vary: me.headers.get('vary') })
// 6. Websocket from foreign origin
const wsEvil = await new Promise(res => { const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws/', { headers: { Origin: 'https://evil.example', Cookie: alice.cookie() } }); const t = setTimeout(() => { ws.close(); res('timeout') }, 5000); ws.onmessage = e => { clearTimeout(t); ws.close(); res('open:' + String(e.data).slice(0, 20)) }; ws.onclose = e => { clearTimeout(t); res('closed:' + e.code) }; ws.onerror = () => {} })
check('websocket from foreign Origin refused (CSWSH)', !String(wsEvil).startsWith('open'), { result: wsEvil })
// 7. Capability enforcement: dave (Messenger user only) on admin endpoints
const dave = new Client(); await dave.login(A.dave)
const dme = await dave.req('GET', '/me/')
const daveCaps = dme.data?.capabilities || []
const adminProbes = [['GET', '/admin/users/'], ['GET', '/admin/approvals/?status=pending'], ['POST', `/admin/users/${A.bob.public_id}/revoke-sessions/`], ['POST', `/admin/users/${A.bob.public_id}/reset-link/`], ['POST', '/admin/users/', { email: 'x@e2e.invalid', first_name: 'x', last_name: 'y' }]]
for (const [m, p, b] of adminProbes) { const r = await dave.req(m, p, { body: b ?? (m === 'POST' ? {} : undefined) }); check(`dave refused ${m} ${p}`, r.status === 403 || r.status === 401, { status: r.status }) }
check('dave lacks ADMIN_USERS capability', !daveCaps.includes('ADMIN_USERS'), { caps: daveCaps })
// 8. Cross-user data: dave not member of alice-bob chat / group
const did = conv.direct_alice_bob.public_id; const gid = conv.group_e2e_team.public_id
for (const [n, id] of [['direct', did], ['group', gid]]) { const r = await dave.req('GET', `/conversations/${id}/messages/`); check(`dave cannot read ${n} chat messages`, [403, 404].includes(r.status), { status: r.status }) ; const s = await dave.req('POST', `/conversations/${id}/messages/`, { body: { client_id: crypto.randomUUID(), body: 'should fail' } }); check(`dave cannot post into ${n} chat`, [403, 404].includes(s.status), { status: s.status }) }
// 9. Vault: bob cannot read alice's vault
const bob = new Client(); await bob.login(A.bob)
const vid = acc.alice_vault.public_id
const jpGet = async (c, p) => (await fetch(BASE + '/api/jp' + p, { headers: { Cookie: c.cookie(), Origin: BASE } })).status
  const bv = { status: await jpGet(bob, `/vaults/${vid}/`) }; const be = { status: await jpGet(bob, `/entries/?vault=${vid}`) }; const av = await jpGet(alice, `/vaults/${vid}/`)
  check('alice can read own vault (control)', [200, 403].includes(av), { status: av })
check('bob cannot read alice vault', [403, 404].includes(bv.status) && be.status !== 500, { vault: bv.status, entries: be.status })
// 10. Logout revokes server session
const aliceCookie = alice.cookie(); const lo = await alice.req('POST', '/auth/logout/', { body: {} })
const replay = await fetch(BASE + '/api/jm/me/', { headers: { Cookie: aliceCookie, Origin: BASE } })
check('logout revokes the session cookie server side', [401, 403].includes(replay.status), { logout: lo.status, replay: replay.status })
await dave.req('POST', '/auth/logout/', { body: {} }); await bob.req('POST', '/auth/logout/', { body: {} })
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(results, null, 2))
console.log('summary', results.filter(r => r.pass).length, '/', results.length)
