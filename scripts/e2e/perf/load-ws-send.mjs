// Load test: N simulated users, each with an open websocket, each sending 1 message/s for D seconds
// into a 5-person "Perf Load Room" (seeded by perf_seed.py). ONLY for the isolated e2e backend on :8010.
// Usage: node load-ws-send.mjs <perf-accounts.json> [base=http://127.0.0.1:8010] [users=50] [seconds=180] [rate=1] [outDir]
// Measures: POST send latency (p50/p95/p99), end-to-end delivery latency (sender POST start -> each other
// member's MESSAGE_CREATED on the websocket), error rate (stops when > 5% over a rolling 30 s window).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const [accFile, base = 'http://127.0.0.1:8010', nArg = '50', secArg = '180', rateArg = '1', outDir = '.'] = process.argv.slice(2)
if (!/^http:\/\/127\.0\.0\.1:8010$/.test(base)) { console.error('refusing: base must be http://127.0.0.1:8010'); process.exit(2) }
const acc = JSON.parse(fs.readFileSync(accFile, 'utf8'))
const N = Number(nArg), SECONDS = Number(secArg), RATE = Number(rateArg)
const origin = base
const names = Object.keys(acc.users).sort().slice(0, N)
const roomOf = {}
for (const r of acc.rooms) for (const m of r.members) roomOf[m] = r.public_id

// one CSRF token (not session-bound) shared by all simulated clients
let r = await fetch(`${base}/api/jm/auth/csrf/`, { headers: { Origin: origin } })
let csrf = ''
for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); if (kv.startsWith('jm_csrftoken=')) csrf = kv.slice(13) }
if (!csrf) { console.error('no csrf cookie'); process.exit(2) }

const t0 = performance.now()
const now = () => performance.now() - t0
const sends = [] // {user, t, ms, status, tag}
const deliveries = [] // ms
const pendingTags = new Map() // tag -> {t, expected, got}
const wsStats = { opened: 0, failed: 0, closed: 0, closedEarly: 0, closeCodes: {}, frames: 0, pings: 0, pongs: 0, connectMs: [] }
// Heartbeat like the app (src/core/realtime/client.ts): PING every 25 s, so the server's idle close (4408 after
// JM_WS_IDLE_CLOSE_SECONDS without a client frame) never fires on a socket that only receives.
const PING_MS = 25000
let finished = false
let stop = false, stopReason = ''

const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))].toFixed(1) }

function openWs(name) {
  return new Promise(resolve => {
    const cookie = `jm_session=${acc.users[name].session}; jm_csrftoken=${csrf}`
    const start = performance.now()
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws/', { headers: { Origin: origin, Cookie: cookie } })
    let done = false
    let heartbeat = null
    ws.onopen = () => { heartbeat = setInterval(() => { if (ws.readyState === 1) try { ws.send(JSON.stringify({ type: 'PING', data: {} })); wsStats.pings++ } catch {} }, PING_MS); wsStats.opened++; wsStats.connectMs.push(performance.now() - start); if (!done) { done = true; resolve(ws) } }
    ws.onerror = () => { if (!done) { done = true; wsStats.failed++; resolve(null) } }
    ws.onclose = e => { clearInterval(heartbeat); if (!finished) wsStats.closedEarly++; wsStats.closed++; wsStats.closeCodes[e.code] = (wsStats.closeCodes[e.code] || 0) + 1 }
    ws.onmessage = e => {
      wsStats.frames++
      let msg; try { msg = JSON.parse(String(e.data)) } catch { return }
      if (msg.type === 'PONG') { wsStats.pongs++; return }
      if (msg.type !== 'MESSAGE_CREATED') return
      const body = msg.data?.body || ''
      const m = /\[LT:([0-9a-f]{12})\]/.exec(body)
      if (!m) return
      const p = pendingTags.get(m[1])
      if (!p) return
      if (msg.data?.sender?.public_id === acc.users[name].public_id || p.sender === name) return
      deliveries.push(now() - p.t); p.got++
    }
    setTimeout(() => { if (!done) { done = true; wsStats.failed++; resolve(null) } }, 15000)
  })
}

async function sendOne(name) {
  const tag = crypto.randomBytes(6).toString('hex')
  const t = now()
  pendingTags.set(tag, { t, sender: name, got: 0 })
  let status = 0
  try {
    const res = await fetch(`${base}/api/jm/conversations/${roomOf[name]}/messages/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, Referer: origin + '/', 'X-CSRFToken': csrf,
        Cookie: `jm_session=${acc.users[name].session}; jm_csrftoken=${csrf}` },
      body: JSON.stringify({ client_id: crypto.randomUUID(), body: `load ${name} [LT:${tag}] ${new Date().toISOString()}` }),
      signal: AbortSignal.timeout(30000),
    })
    status = res.status; await res.arrayBuffer()
  } catch (e) { status = e.name === 'TimeoutError' ? -1 : -2 }
  sends.push({ user: name, t, ms: now() - t, status })
}

console.log(`opening ${names.length} websockets...`)
const sockets = []
for (const n of names) { sockets.push(await openWs(n)); await new Promise(r => setTimeout(r, 40)) }
console.log('ws open', wsStats.opened, 'failed', wsStats.failed, 'connect p50', pct(wsStats.connectMs, 50), 'p95', pct(wsStats.connectMs, 95))

const loadStart = now()
const inflight = Object.fromEntries(names.map(n => [n, 0]))
let skipped = 0
const timers = names.map((n, i) => setTimeout(() => {
  const iv = setInterval(() => {
    if (stop || now() - loadStart > SECONDS * 1000) { clearInterval(iv); return }
    if (inflight[n] >= 5) { skipped++; return }
    inflight[n]++; sendOne(n).finally(() => inflight[n]--)
  }, 1000 / RATE)
}, (i * 1000) / names.length))

const progress = []
const mon = setInterval(() => {
  const t = now()
  const win = sends.filter(s => s.t > t - 30000)
  const errs = win.filter(s => s.status !== 201 && s.status !== 200).length
  const rate = win.length ? errs / win.length : 0
  const last10 = sends.filter(s => s.t > t - 10000)
  const row = { t: Math.round((t - loadStart) / 1000), sent: sends.length, rps10: +(last10.length / 10).toFixed(1),
    p50_10s: pct(last10.map(s => s.ms), 50), p95_10s: pct(last10.map(s => s.ms), 95), errRate30s: +(rate * 100).toFixed(2), skipped }
  progress.push(row); console.log(JSON.stringify(row))
  if (sends.length >= 200 && rate > 0.05) { stop = true; stopReason = `error rate ${(rate * 100).toFixed(1)}% > 5% at t=${row.t}s` }
  if (stop || t - loadStart > SECONDS * 1000 + 35000) finish()
}, 5000)

async function finish() {
  if (finished) return; finished = true
  clearInterval(mon); timers.forEach(clearTimeout)
  await new Promise(r => setTimeout(r, 3000))
  for (const ws of sockets) try { ws?.close(1000) } catch {}
  const ok = sends.filter(s => s.status === 201 || s.status === 200)
  const byStatus = {}; for (const s of sends) byStatus[s.status] = (byStatus[s.status] || 0) + 1
  const expectedDeliveries = ok.length * 4
  const summary = {
    users: names.length, seconds: SECONDS, rate: RATE, stopReason: stopReason || 'completed',
    sends: sends.length, ok: ok.length, byStatus, errorRatePct: +((1 - ok.length / Math.max(1, sends.length)) * 100).toFixed(2),
    skippedBecause5InFlight: skipped,
    achievedSendsPerSec: +(sends.length / ((now() - loadStart) / 1000)).toFixed(2),
    sendLatencyMs: { p50: pct(ok.map(s => s.ms), 50), p95: pct(ok.map(s => s.ms), 95), p99: pct(ok.map(s => s.ms), 99), max: pct(ok.map(s => s.ms), 100) },
    deliveryLatencyMs: { count: deliveries.length, expected: expectedDeliveries, p50: pct(deliveries, 50), p95: pct(deliveries, 95), p99: pct(deliveries, 99), max: pct(deliveries, 100) },
    ws: { ...wsStats, connectMs: { p50: pct(wsStats.connectMs, 50), p95: pct(wsStats.connectMs, 95) } },
  }
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `load-summary-${names.length}u.json`), JSON.stringify({ summary, progress }, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}
