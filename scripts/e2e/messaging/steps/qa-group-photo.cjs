// QA 05-Nov open items: group photo upload through /group-info -> Edit group (alice, owner of "E2E Team"); bob sees it.
module.exports = async ({ P, lib, out, OUT }) => {
  const { alice: A, bob: B } = P
  const group = lib.acc.conversations.group_e2e_team.public_id
  const api = await lib.api('alice'); const bobApi = await lib.api('bob')
  const before = (await api.req('GET', `/api/jm/conversations/${group}/`)).body
  out('avatar before', before && before.avatar_url ? 'set' : 'none')
  const files = []; A.on('response', r => { if (/\/api\/jm\/(files|uploads)\//.test(r.url())) files.push(r.status() + ' ' + new URL(r.url()).pathname.slice(0, 60)) })
  await A.goto(lib.BASE + `group-edit?conversation=${group}`); await A.getByLabel('Group title', { exact: true }).waitFor({ timeout: 60000 })
  const png = await A.evaluate(() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#0ea5e9'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#fff'; g.font = '64px sans-serif'; g.fillText('QA', 80, 150); return c.toDataURL('image/png').split(',')[1] })
  const ch = A.waitForEvent('filechooser', { timeout: 15000 }); await A.getByRole('button', { name: 'Choose group photo', exact: true }).click()
  await (await ch).setFiles({ name: 'qa-group.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  const patch = A.waitForResponse(r => new URL(r.url()).pathname === `/api/jm/conversations/${group}/` && r.request().method() === 'PATCH', { timeout: 120000 })
  await A.getByRole('button', { name: 'Confirm group photo', exact: true }).click()
  const pr = await patch; out('PATCH status', pr.status(), pr.status() >= 300 ? (await pr.text()).slice(0, 200) : '')
  await A.getByRole('button', { name: 'Confirm group photo', exact: true }).waitFor({ state: 'hidden', timeout: 60000 })
  await A.getByRole('button', { name: 'Remove group photo', exact: true }).waitFor({ timeout: 30000 })
  const after = (await api.req('GET', `/api/jm/conversations/${group}/`)).body
  const bobView = (await bobApi.req('GET', `/api/jm/conversations/${group}/`)).body
  out('avatar after (alice api)', after && after.avatar_url ? 'set' : 'none', 'bob api', bobView && bobView.avatar_url ? 'set' : 'none')
  const img = await A.getByLabel('Group photo preview', { exact: true }).evaluate(i => i.tagName === 'IMG' ? i.naturalWidth : (i.querySelector('img') || {}).naturalWidth || 0).catch(() => 0)
  out('alice preview naturalWidth', img); await A.screenshot({ path: OUT + '/qa-open-group-photo-alice.png' })
  await B.goto(lib.BASE + `group-info?conversation=${group}`); await B.getByRole('heading', { name: 'Group info', exact: true }).waitFor({ timeout: 60000 }); await B.waitForTimeout(2000)
  const bobImgs = await B.locator('img').evaluateAll(n => n.filter(i => i.complete && i.naturalWidth > 0 && /\/api\/jm\//.test(i.src)).length)
  out('bob group-info loaded api images', bobImgs); await B.screenshot({ path: OUT + '/qa-open-group-photo-bob.png' })
  out('file responses', files.slice(-10))
  const ok = pr.status() < 300 && after && after.avatar_url && bobView && bobView.avatar_url
  out(ok ? 'PASS group-photo (saved, visible to bob via API)' : 'FAIL group-photo')
}
