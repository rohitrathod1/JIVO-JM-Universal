// Typing indicator re-check with websocket frame capture on bob; Enter key behaviour; tick labels (role img).
module.exports = async ({ P, out, OUT }) => {
  const { alice: A, bob: B } = P; const frames = []; const wsA = []
  const hook = (p, arr, dir) => p.on('websocket', ws => { ws.on(dir, f => { try { const j = JSON.parse(f.payload); arr.push([Date.now(), j.type]) } catch {} }) })
  // existing sockets were opened before; reload to attach listener
  hook(B, frames, 'framereceived'); hook(A, wsA, 'framesent')
  const id = require('C:/Users/JIVO/Desktop/JM/JIVO-JM-Universal/scripts/e2e/messaging/lib.cjs').acc.conversations.direct_alice_bob.public_id
  await B.goto('http://127.0.0.1:4176/messenger?conversation=' + id); await A.goto('http://127.0.0.1:4176/messenger?conversation=' + id)
  await B.getByLabel('Message', { exact: true }).waitFor({ timeout: 60000 }); await A.getByLabel('Message', { exact: true }).waitFor({ timeout: 60000 })
  await A.waitForTimeout(3000)
  const header = B.getByText(/^(typing…|Alice is typing…)$/)
  await A.getByLabel('Message', { exact: true }).click(); await A.getByLabel('Message', { exact: true }).pressSequentially('typing probe for the indicator check', { delay: 120 })
  const shown = await header.first().waitFor({ timeout: 10000 }).then(() => true, () => false)
  out('typing visible on bob:', shown); await B.screenshot({ path: OUT + '/05-bob-typing.png' })
  out('alice ws frames sent types:', [...new Set(wsA.map(f => f[1]))], 'bob ws received types:', [...new Set(frames.map(f => f[1]))])
  await A.getByLabel('Message', { exact: true }).fill('')
  await A.waitForTimeout(6000); out('typing still visible 6s after clear:', await header.count())
  // Enter
  await A.getByLabel('Message', { exact: true }).fill('ENTER probe'); await A.getByLabel('Message', { exact: true }).press('Enter'); await A.waitForTimeout(1500)
  out('after Enter composer value =', JSON.stringify(await A.getByLabel('Message', { exact: true }).inputValue()))
  await A.getByLabel('Message', { exact: true }).fill('')
  // ticks
  const own = A.getByLabel(/^Message from Alice/)
  out('alice own bubbles', await own.count())
  const labels = await A.getByRole('img', { name: /^(Sent|Delivered|Read|Sending|Waiting for the network|Not sent)$/ }).evaluateAll(n => n.map(x => x.getAttribute('aria-label')))
  const counts = {}; for (const l of labels) counts[l] = (counts[l] || 0) + 1; out('alice tick labels counts', counts)
  const last = own.last(); out('last own bubble ticks', await last.getByRole('img').evaluateAll(n => n.map(x => x.getAttribute('aria-label'))))
  // fresh send while bob is viewing -> expect Read
  const t = 'TICK ' + Date.now().toString(36); await A.getByLabel('Message', { exact: true }).fill(t); await A.getByRole('button', { name: 'Send message', exact: true }).click()
  await B.getByText(t, { exact: true }).waitFor({ timeout: 30000 }); const st = Date.now(); let lab = []
  while (Date.now() - st < 20000) { lab = await A.getByLabel(/^Message from /).filter({ hasText: t }).last().getByRole('img').evaluateAll(n => n.map(x => x.getAttribute('aria-label'))); if (lab.includes('Read')) break; await A.waitForTimeout(500) }
  out('tick for fresh msg with bob viewing:', lab, 'after', Date.now() - st, 'ms')
  await A.screenshot({ path: OUT + '/05-alice-ticks.png' })
}
