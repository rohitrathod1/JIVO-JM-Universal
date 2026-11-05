// Attachments with the real 'Send files' control, mention delivery check, search in direct chat, reload + load earlier.
const fs = require('fs')
module.exports = async ({ P, out, OUT }) => {
  const { alice: A, bob: B, carol: C } = P
  const step = async (name, fn) => { try { await fn(); out('PASS', name) } catch (e) { out('FAIL', name, e.message.split('\n').slice(0, 3).join(' ')); for (const [u, p] of Object.entries({ A, B, C })) await p.screenshot({ path: OUT + `/07-fail-${name}-${u}.png` }).catch(() => {}); for (const p of [A, B, C]) await p.keyboard.press('Escape').catch(() => {}) } }
  const tag = Date.now().toString(36)
  const png = await A.evaluate(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#16a34a'; g.fillRect(0, 0, 120, 80); g.fillStyle = '#fff'; g.fillText('E2E', 40, 45); return c.toDataURL('image/png').split(',')[1] })
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
  await step('mention-delivered', async () => {
    const texts = (await A.getByLabel(/^Message from /).allInnerTexts()).slice(-3).map(x => x.replace(/\s+/g, ' ')); out(' alice group last bubbles', texts)
    await C.getByRole('button', { name: 'Open E2E Team', exact: true }).click(); await C.waitForTimeout(4000)
    const ct = (await C.getByLabel(/^Message from /).allInnerTexts()).slice(-3).map(x => x.replace(/\s+/g, ' ')); out(' carol group last bubbles', ct)
  })
  out('alice search dialog still open after Escape:', await A.getByRole('button', { name: 'Close search', exact: true }).count())
  if (await A.getByRole('button', { name: 'Close search', exact: true }).count()) await A.getByRole('button', { name: 'Close search', exact: true }).click()
  await A.getByRole('button', { name: 'Open Bob E2E', exact: true }).click(); await A.getByLabel('Message', { exact: true }).waitFor()
  await step('attach-image', async () => {
    await A.getByRole('button', { name: 'Attach', exact: true }).click()
    const ch = A.waitForEvent('filechooser', { timeout: 15000 }); await A.getByRole('menuitem', { name: 'Photos & videos', exact: true }).click(); await (await ch).setFiles({ name: `e2e-${tag}.png`, mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await A.waitForTimeout(2000); await A.screenshot({ path: OUT + '/07-alice-image-preview.png' })
    await A.getByLabel('Attachment caption').fill(`caption ${tag}`).catch(() => out(' no caption field'))
    await A.getByRole('button', { name: 'Send files', exact: true }).click()
    const t = Date.now(); const tile = B.getByRole('button', { name: `View image e2e-${tag}.png` }).last(); await tile.waitFor({ timeout: 90000 }); out(' bob sees image tile after', Date.now() - t, 'ms; caption shown', await B.getByText(`caption ${tag}`).count())
    await B.waitForTimeout(3000); out(' tile img natural widths', await tile.locator('img').evaluateAll(n => n.map(i => i.complete && i.naturalWidth)))
    await B.screenshot({ path: OUT + '/07-bob-image-tile.png' }); await tile.click(); await B.waitForTimeout(2000); await B.screenshot({ path: OUT + '/07-bob-image-viewer.png' }); await B.keyboard.press('Escape')
  })
  await step('attach-pdf', async () => {
    await A.getByRole('button', { name: 'Attach', exact: true }).click()
    const ch = A.waitForEvent('filechooser', { timeout: 15000 }); await A.getByRole('menuitem', { name: 'Document', exact: true }).click(); await (await ch).setFiles({ name: `e2e-${tag}.pdf`, mimeType: 'application/pdf', buffer: pdf })
    await A.waitForTimeout(1500); await A.getByRole('button', { name: 'Send files', exact: true }).click()
    const tile = B.getByRole('button', { name: new RegExp(`e2e-${tag}\\.pdf`) }).last(); await tile.waitFor({ timeout: 90000 }); out(' bob sees pdf', await tile.getAttribute('aria-label'))
    const dl = B.waitForEvent('download', { timeout: 15000 }).catch(() => null); const pop = B.context().waitForEvent('page', { timeout: 15000 }).catch(() => null); await tile.click(); await B.waitForTimeout(3000)
    await B.screenshot({ path: OUT + '/07-bob-pdf-open.png' }); const d = await dl; const pg = await pop
    out(' pdf open: download=', d ? d.suggestedFilename() : null, 'popup=', pg ? pg.url().slice(0, 60) : null, 'dialog buttons', (await B.getByRole('button').allInnerTexts()).filter(x => /download|save|open|export/i.test(x)))
    if (d) out(' downloaded bytes', fs.statSync(await d.path()).size, 'expected', pdf.length)
    await B.keyboard.press('Escape')
  })
  await step('search-direct', async () => {
    await A.getByRole('button', { name: 'Conversation options', exact: true }).click(); await A.getByRole('button', { name: 'Search', exact: true }).click()
    await A.getByLabel('Search messages', { exact: true }).fill('hello'); await A.getByRole('button', { name: 'Find messages', exact: true }).click(); await A.waitForTimeout(5000)
    const n = await A.getByRole('button', { name: 'Jump to message', exact: true }).count(); out(' results', n)
    if (n) { await A.getByRole('button', { name: 'Jump to message', exact: true }).first().click(); await A.waitForTimeout(3000); out(' jumped, hello visible', await A.getByText(/hello bob/).first().isVisible()) } else await A.getByRole('button', { name: 'Close search', exact: true }).click()
  })
  await step('reload-load-earlier', async () => {
    await A.reload(); await A.waitForTimeout(3000); out(' after reload url', A.url(), 'composer present', await A.getByLabel('Message', { exact: true }).count())
    if (!(await A.getByLabel('Message', { exact: true }).count())) await A.getByRole('button', { name: 'Open Bob E2E', exact: true }).click()
    await A.getByText(`e2e-${tag}.pdf`).last().waitFor({ timeout: 60000 }); out(' persisted pdf after reload')
    const before = await A.getByLabel(/^Message from /).count(); const le = A.getByRole('button', { name: 'Load earlier messages', exact: true })
    out(' load earlier visible', await le.isVisible()); if (await le.isVisible()) { await le.click(); await A.waitForTimeout(4000) }
    const after = await A.getByLabel(/^Message from /).count(); out(' bubbles before/after load earlier', before, after, 'seed msg 1 present', await A.getByText('E2E direct message 1 from', { exact: false }).count())
    await A.screenshot({ path: OUT + '/07-alice-load-earlier.png' })
  })
}
