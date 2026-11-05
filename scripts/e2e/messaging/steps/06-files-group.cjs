// List state, attachments (PNG + PDF) alice->bob, forward to group, carol unread + mention, search.
const fs = require('fs')
module.exports = async ({ P, out, OUT }) => {
  const { alice: A, bob: B, carol: C } = P
  const step = async (name, fn) => { try { await fn(); out('PASS', name) } catch (e) { out('FAIL', name, e.message.split('\n').slice(0, 3).join(' ')); for (const [u, p] of Object.entries({ A, B, C })) await p.screenshot({ path: OUT + `/06-fail-${name}-${u}.png` }).catch(() => {}); for (const p of [A, B, C]) await p.keyboard.press('Escape').catch(() => {}) } }
  for (const [u, p] of [['alice', A], ['bob', B], ['carol', C]]) out(u, 'list rows now', (await p.getByRole('button', { name: /^Open / }).count()), 'progressbars', await p.getByRole('progressbar').count())
  const tag = Date.now().toString(36)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAQ0lEQVR4nO3PQQ0AIBDAMMC/5+MNAvZoFSzZnplZy+Z3wC0DtQ3UNlDbQG0DtQ3UNlDbQG0DtQ3UNlDbQG0DtQ0c+QAUFwF/OEmc7wAAAABJRU5ErkJggg==', 'base64')
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
  const sendBtn = p => p.getByRole('button', { name: /^(Send|Send message|Send attachment|Send \d+.*)$/ }).last()
  await step('attach-image', async () => {
    await A.getByRole('button', { name: 'Attach', exact: true }).click(); const items = await A.getByRole('menuitem').allInnerTexts(); out(' attach menu:', items.map(x => x.trim()))
    const ch = A.waitForEvent('filechooser', { timeout: 15000 }); await A.getByRole('menuitem', { name: /photo|image|gallery/i }).first().click(); await (await ch).setFiles({ name: `e2e-${tag}.png`, mimeType: 'image/png', buffer: png })
    await A.waitForTimeout(1500); await A.screenshot({ path: OUT + '/06-alice-image-preview.png' })
    out(' send btn', await sendBtn(A).getAttribute('aria-label')); await sendBtn(A).click()
    await B.getByRole('button', { name: `View image e2e-${tag}.png` }).last().waitFor({ timeout: 90000 }); out(' bob sees image tile')
    await B.waitForTimeout(2000); await B.screenshot({ path: OUT + '/06-bob-image-tile.png' })
    const loaded = await B.getByRole('button', { name: `View image e2e-${tag}.png` }).last().locator('img').evaluateAll(n => n.map(i => i.complete && i.naturalWidth))
    out(' tile <img> natural widths', loaded)
    await B.getByRole('button', { name: `View image e2e-${tag}.png` }).last().click(); await B.waitForTimeout(1500); await B.screenshot({ path: OUT + '/06-bob-image-viewer.png' }); await B.keyboard.press('Escape')
  })
  await step('attach-pdf', async () => {
    await A.getByRole('button', { name: 'Attach', exact: true }).click()
    const ch = A.waitForEvent('filechooser', { timeout: 15000 }); await A.getByRole('menuitem', { name: /document|file/i }).first().click(); await (await ch).setFiles({ name: `e2e-${tag}.pdf`, mimeType: 'application/pdf', buffer: pdf })
    await A.waitForTimeout(1500); await sendBtn(A).click()
    const tile = B.getByRole('button', { name: new RegExp(`e2e-${tag}\\.pdf`) }).last(); await tile.waitFor({ timeout: 90000 }); out(' bob sees pdf', await tile.getAttribute('aria-label'))
    const dl = B.waitForEvent('download', { timeout: 20000 }).catch(() => null); const pop = B.context().waitForEvent('page', { timeout: 20000 }).catch(() => null); await tile.click(); await B.waitForTimeout(3000)
    await B.screenshot({ path: OUT + '/06-bob-pdf-open.png' }); const d = await dl; const pg = await pop
    out(' pdf open result: download=', d ? d.suggestedFilename() : null, 'popup=', pg ? pg.url().slice(0, 80) : null, 'dialogs', await B.getByRole('dialog').count())
    if (d) { const p = await d.path(); out(' downloaded bytes', fs.statSync(p).size, 'expected', pdf.length) }
    await B.keyboard.press('Escape')
  })
  await step('forward-to-group', async () => {
    const txt = `FWD ${tag} please forward`; await A.getByLabel('Message', { exact: true }).fill(txt); await A.getByRole('button', { name: 'Send message', exact: true }).click()
    const bub = A.getByLabel(/^Message from /).filter({ hasText: txt }).last(); await bub.waitFor({ timeout: 90000 }); await bub.hover(); await bub.getByRole('button', { name: 'Message actions', exact: true }).click()
    await A.getByRole('button', { name: 'Forward message', exact: true }).click(); await A.waitForTimeout(1000); await A.screenshot({ path: OUT + '/06-alice-forward.png' })
    await A.getByText('E2E Team').last().click(); await A.waitForTimeout(500); await A.screenshot({ path: OUT + '/06-alice-forward-picked.png' })
    const fb = A.getByRole('button', { name: /^(Forward|Send)/ }).last(); out(' forward confirm btn', await fb.getAttribute('aria-label')); await fb.click()
    const row = C.getByRole('button', { name: 'Open E2E Team', exact: true }); await C.waitForTimeout(8000); out(' carol row before open', (await row.innerText()).replace(/\n/g, ' | '))
    await row.click(); await C.getByText(txt, { exact: true }).last().waitFor({ timeout: 90000 })
    out(' carol bubble', JSON.stringify(await C.getByLabel(/^Message from /).filter({ hasText: txt }).last().innerText()))
  })
  await step('mention', async () => {
    await C.getByRole('button', { name: /^Open Dave E2E/ }).click().catch(() => {})
    await A.getByRole('button', { name: 'Open E2E Team', exact: true }).click(); await A.getByLabel('Message', { exact: true }).waitFor()
    await A.getByLabel('Message', { exact: true }).pressSequentially('@Car', { delay: 80 }); const sug = A.getByRole('button', { name: /^Mention Carol/ }); await sug.first().waitFor({ timeout: 15000 }); await sug.first().click()
    out(' composer', JSON.stringify(await A.getByLabel('Message', { exact: true }).inputValue())); await A.getByLabel('Message', { exact: true }).pressSequentially(`ping ${tag}`); await A.getByRole('button', { name: 'Send message', exact: true }).click()
    await C.waitForTimeout(10000); const row = C.getByRole('button', { name: 'Open E2E Team', exact: true }); out(' carol row', (await row.innerText()).replace(/\n/g, ' | '), 'mention marker', await row.getByLabel('You were mentioned').count())
    out(' carol bell', await C.getByRole('button', { name: /^Notifications/ }).first().getAttribute('aria-label'))
    await C.screenshot({ path: OUT + '/06-carol-mention.png' })
  })
  await step('search', async () => {
    await A.getByRole('button', { name: 'Conversation options', exact: true }).click(); await A.getByRole('button', { name: 'Search', exact: true }).click()
    await A.getByLabel('Search messages', { exact: true }).fill('group message 7'); await A.getByRole('button', { name: 'Find messages', exact: true }).click(); await A.waitForTimeout(5000)
    const n = await A.getByRole('button', { name: 'Jump to message', exact: true }).count(); out(' results', n); await A.screenshot({ path: OUT + '/06-alice-search.png' })
    if (n) { await A.getByRole('button', { name: 'Jump to message', exact: true }).first().click(); await A.waitForTimeout(3000); out(' jumped; visible', await A.getByText(/E2E group message 7 from/).first().isVisible()) }
  })
  for (const [u, p] of [['alice', A], ['bob', B], ['carol', C]]) await p.screenshot({ path: OUT + `/06-end-${u}.png` })
}
