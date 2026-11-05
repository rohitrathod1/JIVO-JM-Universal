// Backend baseline: alice POSTs 20 messages (API) to the direct chat; bob's websocket times MESSAGE_CREATED arrival.
const { api, acc, API, OUT } = require('./lib.cjs'); const fs = require('fs'); const crypto = require('crypto')
;(async () => {
  const a = await api('alice'), b = await api('bob'); const conv = acc.conversations.direct_alice_bob.public_id
  const cookie = Object.entries(b.jar).map(([k, v]) => k + '=' + v).join('; ')
  const ws = new WebSocket(API.replace('http', 'ws') + '/ws/', { headers: { Origin: API, Cookie: cookie } })
  const seen = new Map(); const types = {}
  ws.onmessage = e => { const f = JSON.parse(e.data); types[f.type] = (types[f.type] || 0) + 1; if (f.type === 'MESSAGE_CREATED' && f.data?.body?.startsWith('LAT-API')) seen.set(f.data.body, Date.now()) }
  await new Promise(r => ws.onopen = r); await new Promise(r => setTimeout(r, 1000))
  const sent = []; const tag = Date.now().toString(36)
  for (let i = 1; i <= 20; i++) { const body = `LAT-API ${tag} #${i}`; const t = Date.now(); const r = await a.req('POST', `/api/jm/conversations/${conv}/messages/`, { body, client_id: crypto.randomUUID() }); sent.push({ body, t, status: r.status, post_ms: Date.now() - t, seq: r.body?.seq }); await new Promise(r => setTimeout(r, 600)) }
  await new Promise(r => setTimeout(r, 3000)); ws.close()
  const lat = sent.map(s => seen.has(s.body) ? seen.get(s.body) - s.t : null)
  const ok = lat.filter(x => x != null).sort((x, y) => x - y)
  const res = { sent: sent.length, statuses: sent.map(s => s.status), received: ok.length, min: ok[0], p50: ok[Math.floor(ok.length / 2)], p95: ok[Math.floor(ok.length * 0.95)], max: ok.at(-1), post_ms: sent.map(s => s.post_ms), seqs: sent.map(s => s.seq), wsTypes: types, inOrder: sent.every((s, i) => i === 0 || (seen.get(s.body) >= seen.get(sent[i - 1].body))) }
  fs.writeFileSync(OUT + '/api-latency.json', JSON.stringify(res, null, 1)); console.log(JSON.stringify(res))
})().catch(e => { console.error('FAIL', e); process.exit(1) })
