// Reply/quote, edit, reaction, delete for me / for everyone, long message + emoji. Alice acts, bob observes.
module.exports = async ({ P, out, OUT }) => {
  const { alice: A, bob: B } = P; const tag = Date.now().toString(36)
  const composer = p => p.getByLabel('Message', { exact: true })
  const send = async (p, text) => { await composer(p).fill(text); await p.getByRole('button', { name: 'Send message', exact: true }).click() }
  const actions = async (p, text) => { const bub = p.getByLabel(/^Message from /).filter({ hasText: text }).last(); await bub.scrollIntoViewIfNeeded(); await bub.hover(); await bub.getByRole('button', { name: 'Message actions', exact: true }).click(); return bub }
  const step = async (name, fn) => { try { await fn(); out('PASS', name) } catch (e) { out('FAIL', name, e.message.split('\n').slice(0, 3).join(' ')); await A.screenshot({ path: OUT + `/04-fail-${name}-alice.png` }); await B.screenshot({ path: OUT + `/04-fail-${name}-bob.png` }); await A.keyboard.press('Escape').catch(() => {}) } }
  const base = `ACT ${tag} original`; await send(A, base); await B.getByText(base, { exact: true }).waitFor({ timeout: 90000 })
  await step('reply', async () => {
    await actions(A, base); await A.getByRole('button', { name: 'Reply', exact: true }).click()
    const r = `ACT ${tag} reply text`; await send(A, r); await B.getByText(r, { exact: true }).waitFor({ timeout: 90000 })
    const q = B.getByLabel(/^Message from /).filter({ hasText: r }).last().getByRole('button', { name: /^Replied message from / })
    out(' reply quote on bob:', await q.count(), await q.first().innerText().catch(() => '-'))
    if (!(await q.count())) throw Error('no quote on receiver')
    await q.first().click(); await B.waitForTimeout(800); out(' jump-to-quoted ok')
  })
  await step('edit', async () => {
    await actions(A, base); await A.getByRole('button', { name: 'Edit message', exact: true }).click()
    const e = `ACT ${tag} edited ✏️`; await composer(A).fill(e); await A.getByRole('button', { name: 'Save edit', exact: true }).click()
    await B.getByText(e, { exact: true }).waitFor({ timeout: 90000 })
    out(' bob bubble after edit:', JSON.stringify(await B.getByLabel(/^Message from /).filter({ hasText: e }).last().innerText()))
    out(' bob still shows original?', await B.getByText(base, { exact: true }).count())
  })
  await step('react', async () => {
    const txt = `ACT ${tag} edited ✏️`; await actions(B, txt)
    const quick = B.getByRole('button', { name: /^React / }).first(); const label = await quick.getAttribute('aria-label'); await quick.click(); out(' bob clicked', label)
    await A.getByRole('button', { name: /^Reactions: / }).last().waitFor({ timeout: 90000 })
    out(' alice sees', await A.getByLabel(/^Message from /).filter({ hasText: txt }).last().getByRole('button', { name: /^Reactions: / }).getAttribute('aria-label').catch(e => 'not on that bubble'))
  })
  await step('long-emoji', async () => {
    const long = `LONG ${tag} ` + 'Lorem ipsum dolor sit amet 😀🎉👍🏽 नमस्ते مرحبا '.repeat(40)
    await send(A, long.trim()); const t = Date.now(); await B.getByText(`LONG ${tag}`, { exact: false }).last().waitFor({ timeout: 90000 })
    const got = await B.getByLabel(/^Message from /).filter({ hasText: `LONG ${tag}` }).last().innerText()
    out(' long msg chars sent', long.trim().length, 'body intact on bob:', got.includes(long.trim()), Date.now() - t, 'ms')
    out(' horizontal overflow bob:', await B.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    const read = await A.getByLabel(/^Message from /).filter({ hasText: `LONG ${tag}` }).last().innerText(); out(' alice copy intact:', read.includes(long.trim()), read.length)
    await B.screenshot({ path: OUT + '/04-bob-long.png' })
  })
  await step('delete-everyone', async () => {
    const d = `ACT ${tag} to delete`; await send(A, d); await B.getByText(d, { exact: true }).waitFor({ timeout: 90000 })
    await actions(A, d); await A.getByRole('button', { name: 'Delete for everyone', exact: true }).click(); await A.getByRole('button', { name: 'Confirm delete', exact: true }).click()
    await B.getByText(d, { exact: true }).waitFor({ state: 'detached', timeout: 90000 }); out(' bob placeholders:', await B.getByText('This message was deleted', { exact: true }).count(), 'alice:', await A.getByText('You deleted this message', { exact: true }).count())
  })
  await step('delete-for-me', async () => {
    const d = `ACT ${tag} hide for me`; await send(A, d); await B.getByText(d, { exact: true }).waitFor({ timeout: 90000 })
    await actions(B, d); await B.getByRole('button', { name: 'Delete for me', exact: true }).click(); await B.getByRole('button', { name: 'Confirm delete', exact: true }).click()
    await B.waitForTimeout(2500); out(' bob still sees text:', await B.getByText(d, { exact: true }).count(), 'alice still sees:', await A.getByText(d, { exact: true }).count())
  })
  await A.screenshot({ path: OUT + '/04-alice.png' }); await B.screenshot({ path: OUT + '/04-bob.png' })
}
