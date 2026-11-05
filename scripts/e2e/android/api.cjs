// Isolated-backend API helper (http://127.0.0.1:8010 only).
// Usage: node api.cjs send <user> <body>      -> bob sends to alice-bob direct chat
//        node api.cjs list <user> [n]         -> last n messages (sender email, body, id)
const fs = require('node:fs')
const BASE = 'http://127.0.0.1:8010'
const acc = JSON.parse(fs.readFileSync(process.env.JM_E2E_ACCOUNTS, 'utf8').replace(/^﻿/, ''))
const conv = acc.conversations.direct_alice_bob.public_id
async function client(user) {
  const jar = new Map()
  const call = async (route, method = 'GET', body) => {
    const r = await fetch(BASE + '/api/jm' + route, { method, signal: AbortSignal.timeout(20000), headers: { Origin: BASE, Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; '), 'Content-Type': 'application/json', 'X-CSRFToken': jar.get('jm_csrftoken') || jar.get('csrftoken') || '' }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of r.headers.getSetCookie()) { const p = c.split(';')[0], i = p.indexOf('='); jar.set(p.slice(0, i), p.slice(i + 1)) }
    const text = await r.text(); if (!r.ok) throw Error(route + ' HTTP ' + r.status + ' ' + text.slice(0, 200))
    return text ? JSON.parse(text) : null
  }
  await call('/auth/csrf/'); await call('/auth/login/', 'POST', { email: acc.accounts[user].email, password: acc.accounts[user].password })
  return call
}
;(async () => {
  const [cmd, user, ...rest] = process.argv.slice(2)
  const call = await client(user)
  if (cmd === 'send') {
    const m = await call(`/conversations/${conv}/messages/`, 'POST', { body: rest.join(' '), client_id: 'e2e-android-' + Date.now() })
    console.log(JSON.stringify({ id: m.id || m.public_id, body: m.body, created: m.created_at }))
  } else if (cmd === 'list') {
    const d = await call(`/conversations/${conv}/messages/?limit=${rest[0] || 10}`)
    for (const m of (d.results || d)) console.log(JSON.stringify({ id: m.id || m.public_id, from: m.sender?.email || m.sender?.display_name, body: m.body, at: m.created_at }))
  }
  await call('/auth/logout/', 'POST').catch(() => {})
})().catch(e => { console.error(e.message); process.exit(1) })
