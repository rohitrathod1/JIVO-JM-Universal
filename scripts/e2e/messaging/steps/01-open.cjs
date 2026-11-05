// Record chat-list previews/badges for all users, then alice+bob open the direct chat and carol stays on the list.
module.exports = async ({ P, out, OUT }) => {
  for (const u of ['alice', 'bob', 'carol']) {
    const p = P[u]; await p.waitForTimeout(500)
    const rows = await p.getByRole('button', { name: /^Open / }).allInnerTexts()
    out(u, 'list rows', rows.map(r => r.replace(/\n/g, ' | ')))
    await p.screenshot({ path: OUT + `/01-list-${u}.png` })
  }
  await P.alice.getByRole('button', { name: 'Open Bob E2E', exact: true }).click()
  await P.bob.getByRole('button', { name: 'Open Alice E2E', exact: true }).click()
  for (const u of ['alice', 'bob']) {
    const t = Date.now(); await P[u].getByText('E2E direct message 30 from Bob', { exact: true }).last().waitFor({ timeout: 120000 }); out(u, 'history visible after', Date.now() - t, 'ms')
  }
  const rows = await P.alice.getByRole('button', { name: /^Open / }).allInnerTexts(); out('alice list after open', rows.map(r => r.replace(/\n/g, ' | ')))
  const ticks = await P.alice.getByRole('image', { name: /^(Sent|Delivered|Read|Sending)$/ }).evaluateAll(n => n.map(x => x.getAttribute('aria-label')))
  out('alice tick labels', ticks)
  await P.alice.screenshot({ path: OUT + '/01-alice-direct.png' }); await P.bob.screenshot({ path: OUT + '/01-bob-direct.png' })
}
