const assert = require('node:assert/strict')
const { expect } = require('@playwright/test')

// Called by the authenticated mocked UI harness. No real backend data is accessed.
module.exports = async function shareUi(page, { base, me, conversation }) {
  let active = true
  const uploads = [], sends = []
  let failSecond = true
  const chats = [
    { ...conversation, id: 'share-one', title: 'Share destination one', locked: false },
    { ...conversation, id: 'share-two', title: 'Share destination two', locked: false },
    { ...conversation, id: 'share-locked', title: 'Locked share destination', locked: true },
  ]
  const routeHandler = async route => {
    if (!active) return route.fallback()
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/api/jm/conversations/' && req.method() === 'GET') return json({ results: chats, next_cursor: null })
    const detail = chats.find(chat => path === `/api/jm/conversations/${chat.id}/`)
    if (detail) return json(detail)
    if (path === '/api/jm/uploads/' && req.method() === 'POST') {
      assert.ok(req.headers()['x-csrftoken'])
      uploads.push(req.headers()['idempotency-key'])
      return json({ id: 'shared-upload-' + uploads.length, status: 'ready', name: 'incoming-note.txt', size: 5, mime: 'text/plain', kind: 'file', download_url: '/api/jm/files/shared', thumb_url: null })
    }
    if (/^\/api\/jm\/conversations\/share-(one|two)\/messages\/$/.test(path) && req.method() === 'POST') {
      const body = req.postDataJSON(); sends.push({ path, body })
      assert.ok(req.headers()['x-csrftoken'])
      if (path.includes('share-two') && failSecond) { failSecond = false; return json({ detail: 'Synthetic response interruption' }, 503) }
      return json({ id: 'shared-message-' + sends.length, ...body })
    }
    return route.fallback()
  }
  await page.route('**/api/jm/**', routeHandler)
  async function seed(owner, at = Date.now(), caption = 'Incoming fixture text') {
    await page.evaluate(async value => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('jm-incoming-share-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('pending'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      await new Promise((resolve, reject) => { const tx = db.transaction('pending', 'readwrite'); tx.objectStore('pending').put({ id: crypto.randomUUID(), owner: value.owner, at: value.at, caption: value.caption, files: [new File(['hello'], 'incoming-note.txt', { type: 'text/plain' })] }, 'incoming'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) })
      db.close()
    }, { owner, at, caption })
  }
  try {
    await seed(me.id)
    await page.goto(base + '/share')
    await page.getByLabel('Caption (optional)', { exact: true }).waitFor()
    await expect(page.getByRole('button', { name: 'Locked share destination', exact: true })).toHaveCount(0)
    assert.equal(sends.length, 0, 'Incoming content must not send automatically')
    await page.getByRole('button', { name: 'Share destination one', exact: true }).click()
    await page.getByRole('button', { name: 'Share destination two', exact: true }).click()
    await page.getByRole('button', { name: 'Send (2)', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Retry remaining chats', exact: true })).toBeEnabled()
    await page.reload()
    await page.getByRole('button', { name: 'Retry remaining chats', exact: true }).click()
    await expect(page).toHaveURL(/\/messenger/)
    assert.equal(uploads.length, 2)
    assert.equal(new Set(uploads).size, 2, 'Each destination receives its own separately uploaded copy')
    assert.equal(sends.length, 3)
    assert.equal(sends[1].body.client_id, sends[2].body.client_id, 'Reload/retry retains message idempotency key')
    assert.equal(sends.filter(send => send.path.includes('share-one')).length, 1)
    await seed('another-account', Date.now(), 'MUST_NOT_SHOW_OTHER_OWNER')
    await page.goto(base + '/share')
    await page.getByText('Nothing to share', { exact: true }).waitFor()
    await expect(page.getByText('MUST_NOT_SHOW_OTHER_OWNER')).toHaveCount(0)
    await seed(me.id, Date.now() - 600001)
    await page.reload()
    await page.getByText('Nothing to share', { exact: true }).waitFor()
    assert.equal(sends.length, 3)
    console.log('PASS incoming share: explicit review, locked destinations hidden, separate uploads, partial retry after reload, account isolation and expiry')
  } finally {
    active = false
    await page.unroute('**/api/jm/**', routeHandler)
    await page.goto(base + '/messenger')
  }
}
