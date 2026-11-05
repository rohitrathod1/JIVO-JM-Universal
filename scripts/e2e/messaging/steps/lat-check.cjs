module.exports = async ({ P, out, OUT, fs }) => { await P.alice.waitForTimeout(45000)
  const { api, acc } = require('C:/Users/JIVO/Desktop/JM/JIVO-JM-Universal/scripts/e2e/messaging/lib.cjs'); const a = await api('alice')
  const r = await a.req('GET', `/api/jm/conversations/${acc.conversations.direct_alice_bob.public_id}/messages/`); const srv = (r.body.results || []).filter(m => /LAT-UI-mw25n4jz/.test(m.body)).map(m => m.body)
  const cnt = {}; for (const b of srv) cnt[b] = (cnt[b] || 0) + 1; out('server copies', Object.keys(cnt).length, 'dups', Object.entries(cnt).filter(([, v]) => v > 1))
  const arr = await P.bob.evaluate(() => window.__arr); out('bob arrivals recorded', Object.keys(arr || {}).length)
  for (const u of ['alice', 'bob']) { out(u, 'LAT-UI texts', await P[u].getByText(/^LAT-UI-mw25n4jz #\d+$/).count(), 'clock(sending) icons', await P[u].getByRole('img', { name: /Sending|Waiting/ }).count()); await P[u].screenshot({ path: OUT + `/lat-check-${u}.png` }) } }
