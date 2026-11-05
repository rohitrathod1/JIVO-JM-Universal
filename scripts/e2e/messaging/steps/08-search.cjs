module.exports = async ({ P, out, OUT }) => { const A = P.alice; const reqs = []; A.on('response', r => { if (r.url().includes('/search/messages')) reqs.push(r.status() + ' ' + r.url().replace(/^.*\/api/, '')) })
  await A.goto('http://127.0.0.1:4176/messenger?conversation=01a1a688-7d54-7daa-8402-27a07e18ab8a'); await A.getByLabel('Message', { exact: true }).waitFor({ timeout: 60000 })
  await A.getByRole('button', { name: 'Conversation options', exact: true }).click(); await A.getByRole('button', { name: 'Search', exact: true }).click()
  await A.getByLabel('Search messages', { exact: true }).fill('hello'); await A.getByRole('button', { name: 'Find messages', exact: true }).click(); await A.waitForTimeout(6000)
  out('results', await A.getByRole('button', { name: 'Jump to message', exact: true }).count(), 'requests', reqs); await A.screenshot({ path: OUT + '/08-search-hello.png' })
  await A.keyboard.press('Escape'); await A.waitForTimeout(500); out('dialog open after Escape', await A.getByRole('button', { name: 'Close search', exact: true }).count())
  if (await A.getByRole('button', { name: 'Close search', exact: true }).count()) await A.getByRole('button', { name: 'Close search', exact: true }).click()
  const t = await A.getByRole('button', { name: /^View image e2e-/ }).last().locator('img').evaluateAll(n => n.map(i => [i.complete, i.naturalWidth, i.src.replace(/^.*\/api/, '')])); out('alice image tile imgs', t) }
