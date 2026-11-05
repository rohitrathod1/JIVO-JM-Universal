// QA re-test 05-Nov: M-01 attachments (image tile + PDF for alice and bob), Enter-to-send, reload keeps the open chat.
const fs = require('fs')
module.exports = async ({ P, out, OUT }) => {
  const { alice: A, bob: B } = P
  const files = { alice: [], bob: [] }
  for (const [u, p] of [['alice', A], ['bob', B]]) p.on('response', r => { const m = r.url().match(/\/api\/jm\/files\/([0-9a-f-]{36})\/(\?[^#]*)?/); if (m) files[u].push(r.status() + ' ' + m[1].slice(-6) + (m[2] || '')) })
  const step = async (name, fn) => { try { await fn(); out('PASS', name) } catch (e) { out('FAIL', name, e.message.split('\n').slice(0, 3).join(' ')); for (const [u, p] of Object.entries({ A, B })) await p.screenshot({ path: OUT + `/qa-fail-${name}-${u}.png` }).catch(() => {}); for (const p of [A, B]) await p.keyboard.press('Escape').catch(() => {}) } }
  const dismiss = async p => { for (let i = 0; i < 3; i++) { const b = p.getByRole('button', { name: 'Not now', exact: true }); if (await b.count()) { await b.first().click().catch(() => {}); await p.waitForTimeout(300) } else break } }
  await dismiss(A); await dismiss(B)
  const tag = 'qa' + Date.now().toString(36)
  const png = await A.evaluate(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#16a34a'; g.fillRect(0, 0, 120, 80); g.fillStyle = '#fff'; g.fillText('QA', 50, 45); return c.toDataURL('image/png').split(',')[1] })
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
  await A.getByRole('button', { name: 'Open Bob E2E', exact: true }).click(); await A.getByLabel('Message', { exact: true }).waitFor({ timeout: 60000 })
  await B.getByRole('button', { name: 'Open Alice E2E', exact: true }).click(); await B.getByLabel('Message', { exact: true }).waitFor({ timeout: 60000 })
  await step('attach-image', async () => {
    await A.getByRole('button', { name: 'Attach', exact: true }).click()
    const ch = A.waitForEvent('filechooser', { timeout: 15000 }); await A.getByRole('menuitem', { name: 'Photos & videos', exact: true }).click(); await (await ch).setFiles({ name: `e2e-${tag}.png`, mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await A.waitForTimeout(1500); const sendResp = A.waitForResponse(r => /\/messages\/?$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 60000 }).catch(() => null)
    await A.getByRole('button', { name: 'Send files', exact: true }).click(); const sr = await sendResp; out(' send status', sr ? sr.status() : 'none', sr && sr.status() >= 300 ? (await sr.text()).slice(0, 200) : '')
    for (const [u, p] of [['alice', A], ['bob', B]]) {
      const t = Date.now(); const tile = p.getByRole('button', { name: `View image e2e-${tag}.png` }).last(); await tile.waitFor({ timeout: 90000 })
      await p.waitForFunction(n => [...document.querySelectorAll(`[aria-label="View image ${n}"] img`)].some(i => i.complete && i.naturalWidth > 0), `e2e-${tag}.png`, { timeout: 30000 }).catch(() => {})
      const w = await tile.locator('img').evaluateAll(n => n.map(i => i.complete && i.naturalWidth)); out(` ${u} tile after ${Date.now() - t} ms, img natural widths`, w)
      if (!w.some(x => x > 0)) throw Error(u + ' image tile did not load')
      await p.screenshot({ path: OUT + `/qa-${u}-image-tile.png` })
    }
    await B.getByRole('button', { name: `View image e2e-${tag}.png` }).last().click(); await B.waitForTimeout(2000)
    out(' bob viewer imgs', await B.locator('img').evaluateAll(n => n.filter(i => i.naturalWidth > 0).length)); await B.screenshot({ path: OUT + '/qa-bob-image-viewer.png' }); await B.keyboard.press('Escape')
  })
  await step('attach-pdf', async () => {
    await A.getByRole('button', { name: 'Attach', exact: true }).click()
    const ch = A.waitForEvent('filechooser', { timeout: 15000 }); await A.getByRole('menuitem', { name: 'Document', exact: true }).click(); await (await ch).setFiles({ name: `e2e-${tag}.pdf`, mimeType: 'application/pdf', buffer: pdf })
    await A.waitForTimeout(1500); await A.getByRole('button', { name: 'Send files', exact: true }).click()
    for (const [u, p] of [['bob', B], ['alice', A]]) {
      const tile = p.getByRole('button', { name: new RegExp(`e2e-${tag}\\.pdf`) }).last(); await tile.waitFor({ timeout: 90000 })
      const dl = p.waitForEvent('download', { timeout: 20000 }).catch(() => null); const pop = p.context().waitForEvent('page', { timeout: 20000 }).catch(() => null); await tile.click(); await p.waitForTimeout(3000)
      const d = await dl; const pg = await pop; let bytes = null
      if (d) bytes = fs.statSync(await d.path()).size
      let popStatus = null; if (pg) { try { await pg.waitForLoadState('load', { timeout: 10000 }) } catch { /* */ } popStatus = pg.url().slice(0, 80); await pg.close().catch(() => {}) }
      out(` ${u} pdf: download=`, d ? d.suggestedFilename() : null, 'bytes', bytes, 'expected', pdf.length, 'popup', popStatus)
      await p.screenshot({ path: OUT + `/qa-${u}-pdf-open.png` }); await p.keyboard.press('Escape')
      if (!(bytes === pdf.length || popStatus)) throw Error(u + ' could not open the pdf')
    }
  })
  await step('enter-sends', async () => {
    const box = A.getByLabel('Message', { exact: true }); await box.click(); await box.pressSequentially(`line1 ${tag}`); await A.keyboard.press('Shift+Enter'); await box.pressSequentially('line2')
    out(' after shift+enter value', JSON.stringify(await box.inputValue()))
    if (!/\n/.test(await box.inputValue())) throw Error('Shift+Enter did not add a newline')
    await A.keyboard.press('Enter'); await A.waitForTimeout(500); out(' composer after Enter', JSON.stringify(await box.inputValue()))
    await B.getByText(`line1 ${tag}`, { exact: false }).last().waitFor({ timeout: 60000 }); out(' bob received multi-line message')
  })
  await step('reload-keeps-chat', async () => {
    const before = A.url(); await A.reload(); await A.waitForTimeout(2500); await dismiss(A); await A.getByLabel('Message', { exact: true }).waitFor({ timeout: 60000 }).catch(() => {})
    const composer = await A.getByLabel('Message', { exact: true }).count()
    const header = await A.getByText('Bob E2E').count()
    out(' url before', before.replace(/^https?:\/\/[^/]+/, ''), 'after', A.url().replace(/^https?:\/\/[^/]+/, ''), 'composer', composer, 'pdf visible', await A.getByText(`e2e-${tag}.pdf`).count())
    if (!composer || !/conversation=/.test(A.url())) throw Error('open chat not kept after reload')
    if (!header) throw Error('header missing')
  })
  out('files responses alice', files.alice.slice(-12)); out('files responses bob', files.bob.slice(-12))
  const bad = [...files.alice, ...files.bob].filter(x => !/^(200|206|304)/.test(x)); out('non-2xx file responses', bad)
}
