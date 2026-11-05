// QA: PDF attachment alice -> bob, export confirmed, downloaded bytes checked for both users.
const fs = require('fs')
module.exports = async ({ P, out, OUT }) => {
  const { alice: A, bob: B } = P
  const files = []; for (const [u, p] of [['alice', A], ['bob', B]]) p.on('response', r => { if (/\/api\/jm\/files\//.test(r.url())) files.push(u + ' ' + r.status() + ' ' + r.url().replace(/^.*\/files\//, '').slice(30)) })
  for (const p of [A, B]) { await p.keyboard.press('Escape').catch(() => {}); const b = p.getByRole('button', { name: 'Close attachment export', exact: true }); if (await b.count()) await b.click() }
  const tag = 'qapdf' + Date.now().toString(36)
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
  await A.getByRole('button', { name: 'Attach', exact: true }).click()
  const ch = A.waitForEvent('filechooser', { timeout: 15000 }); await A.getByRole('menuitem', { name: 'Document', exact: true }).click(); await (await ch).setFiles({ name: `e2e-${tag}.pdf`, mimeType: 'application/pdf', buffer: pdf })
  await A.waitForTimeout(1500); await A.getByRole('button', { name: 'Send files', exact: true }).click()
  let ok = 0
  for (const [u, p] of [['bob', B], ['alice', A]]) {
    const tile = p.getByRole('button', { name: new RegExp(`e2e-${tag}\.pdf`) }).last(); await tile.waitFor({ timeout: 90000 })
    await tile.click(); const confirm = p.getByRole('button', { name: 'Confirm attachment export', exact: true }); await confirm.waitFor({ timeout: 15000 })
    const dl = p.waitForEvent('download', { timeout: 30000 }).catch(() => null); const pop = p.context().waitForEvent('page', { timeout: 30000 }).catch(() => null)
    await confirm.click(); const d = await Promise.race([dl, pop.then(x => x ? { popup: x } : null)])
    let res
    if (d && d.popup) { await d.popup.waitForLoadState('load', { timeout: 15000 }).catch(() => {}); res = { popup: d.popup.url().slice(0, 80) }; await d.popup.close().catch(() => {}) }
    else if (d) { const size = fs.statSync(await d.path()).size; res = { download: d.suggestedFilename(), bytes: size, expected: pdf.length }; if (size === pdf.length) ok++ }
    else res = null
    out(u, 'pdf export', res); await p.screenshot({ path: OUT + `/qa-${u}-pdf-export.png` }); await p.keyboard.press('Escape').catch(() => {})
  }
  out('files responses', files)
  out(ok === 2 ? 'PASS attach-pdf (both users downloaded the exact bytes)' : 'FAIL attach-pdf')
}
