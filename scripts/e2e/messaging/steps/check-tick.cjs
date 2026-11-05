// After a backend outage: did the message composed during the outage (TICK mw25ieoe) survive and send?
module.exports = async ({ P, out, OUT }) => { await P.alice.waitForTimeout(15000)
  for (const u of ['alice','bob']) { const n = await P[u].getByText(/^TICK mw25ieoe/).count(); out(u, 'TICK copies', n, 'banner:', (await P[u].locator('body').innerText()).split('\n')[0]); await P[u].screenshot({ path: OUT + `/check-tick-${u}.png` }) }
  const api = await require('C:/Users/JIVO/Desktop/JM/JIVO-JM-Universal/scripts/e2e/messaging/lib.cjs').api('alice'); const r = await api.req('GET', '/api/jm/conversations/01a1a688-7d54-7daa-8402-27a07e18ab8a/messages/')
  out('server has TICK:', (r.body.results || []).filter(m => (m.body || '').startsWith('TICK')).map(m => m.body + ' seq' + m.seq))
}
