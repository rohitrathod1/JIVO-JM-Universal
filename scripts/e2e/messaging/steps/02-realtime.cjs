// Typing indicator, send/receive both directions, ordering, ticks, unread on carol's list unaffected.
module.exports = async ({ P, out, OUT }) => {
  const { alice: A, bob: B } = P; const tag = Date.now().toString(36)
  const composer = p => p.getByLabel('Message', { exact: true })
  // typing
  await composer(A).click(); await composer(A).pressSequentially('typing probe', { delay: 60 })
  const typing = await B.getByText(/Alice is typing…|typing…/).first().waitFor({ timeout: 15000 }).then(() => 'shown', e => 'NOT shown: ' + e.message.split('\n')[0])
  out('typing indicator on bob:', typing); await B.screenshot({ path: OUT + '/02-bob-typing.png' })
  await composer(A).fill('')
  // alice -> bob
  const m1 = `RT-A ${tag} hello bob`; await composer(A).fill(m1); let t = Date.now(); await A.getByRole('button', { name: 'Send message', exact: true }).click()
  await B.getByText(m1, { exact: true }).waitFor({ timeout: 30000 }); out('A->B UI latency', Date.now() - t, 'ms')
  // composer cleared?
  out('alice composer after send =', JSON.stringify(await composer(A).inputValue()))
  // bob -> alice
  const m2 = `RT-B ${tag} hi alice`; await composer(B).fill(m2); t = Date.now(); await composer(B).press('Enter')
  const enter = await A.getByText(m2, { exact: true }).waitFor({ timeout: 15000 }).then(() => 'sent by Enter', () => 'Enter did not send')
  out('B Enter key:', enter, Date.now() - t, 'ms')
  if (enter !== 'sent by Enter') { await B.getByRole('button', { name: 'Send message', exact: true }).click(); await A.getByText(m2, { exact: true }).waitFor({ timeout: 30000 }) }
  // ordering in both views
  for (const [u, p] of [['alice', A], ['bob', B]]) {
    const all = await p.getByLabel(/^Message from /).allInnerTexts(); const i1 = all.findIndex(x => x.includes(m1)), i2 = all.findIndex(x => x.includes(m2))
    out(u, 'order idx', i1, i2, i1 < i2 ? 'OK' : 'WRONG'); out(u, 'last bubble text', JSON.stringify(all.at(-1)))
  }
  await A.waitForTimeout(3000)
  const bubble = A.getByLabel(/^Message from /).filter({ hasText: m1 }).last()
  out('alice tick on m1 (bob has chat open):', await bubble.getByRole('image', { name: /^(Sent|Delivered|Read|Sending|Waiting for the network|Not sent)$/ }).evaluateAll(n => n.map(x => x.getAttribute('aria-label'))))
  out('timestamp text in m1 bubble:', JSON.stringify(await bubble.innerText()))
  await A.screenshot({ path: OUT + '/02-alice.png' }); await B.screenshot({ path: OUT + '/02-bob.png' })
  const crows = await P.carol.getByRole('button', { name: /^Open / }).allInnerTexts(); out('carol list', crows.map(r => r.replace(/\n/g, ' | ')))
}
