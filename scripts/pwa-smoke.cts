import assert = require('node:assert/strict')
import fs = require('node:fs')
import http = require('node:http')
import path = require('node:path')
import { spawn } from 'node:child_process'
import { chromium, type Browser } from '@playwright/test'

async function main() {
  const root = path.resolve(__dirname, '..')
  const artifacts = path.join(root, 'test-results')
  const fixture = path.join(artifacts, 'pwa-fixture')
  fs.mkdirSync(fixture, { recursive: true })
  fs.cpSync(path.join(root, 'dist'), fixture, { recursive: true, force: true })
  const apiPort = 5189
  const port = 5188
  const origin = `http://127.0.0.1:${port}`
  const requests: string[] = []
  // Isolated HTTP fixture verifies cache boundaries. This is not a backend E2E test.
  const api = http.createServer((req, res) => {
    requests.push(req.url || '/')
    if (req.url === '/api/jm/auth/csrf/') { res.writeHead(204); res.end(); return }
    if (req.url === '/api/pwa-private-probe') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ private: 'must-never-enter-cache-storage' })); return }
    res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ detail: 'Authentication required.' }))
  })
  await new Promise<void>((resolve, reject) => { api.once('error', reject); api.listen(apiPort, '127.0.0.1', resolve) })
  const preview = spawn(process.execPath, ['--import', 'tsx', path.join(root, 'scripts', 'preview-web.cts')], {
    cwd: root, windowsHide: true, stdio: 'pipe', env: { ...process.env, JM_PREVIEW_PORT: String(port), JM_BACKEND_URL: `http://127.0.0.1:${apiPort}`, JM_WEB_DIST: fixture },
  })
  let logs = ''
  preview.stdout?.on('data', value => { logs += String(value) })
  preview.stderr?.on('data', value => { logs += String(value) })
  let browser: Browser | undefined
  const checks: string[] = []
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), status: 'failed', scope: 'Production PWA with isolated HTTP fixture; not backend integration', checks }
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(origin)).ok) break } catch { /* server starting */ }
      if (i === 99) throw Error(`Preview did not start: ${logs}`)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const started = Date.now()
    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await page.getByLabel('Email address', { exact: true }).waitFor()
    report.onlineStartupMs = Date.now() - started
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href
      if (!href) throw Error('Missing manifest link')
      return await (await fetch(href)).json() as { name: string; display: string; icons: { src: string }[] }
    })
    assert.equal(manifest.name, 'JIVO JM')
    assert.equal(manifest.display, 'standalone')
    for (const icon of manifest.icons) assert.equal((await fetch(origin + icon.src)).status, 200)
    checks.push('Production app loads; manifest, original install icons and service worker available')
    const shared = await page.evaluate(async () => {
      const form = new FormData(); form.set('title', 'Incoming share fixture'); form.set('text', 'Review before sending'); form.append('files', new File(['fixture'], 'incoming-fixture.txt', { type: 'text/plain' }))
      const response = await fetch('/share-target', { method: 'POST', body: form })
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const open = indexedDB.open('jm-incoming-share-v1', 1); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error) })
      const record = await new Promise<{ id: string; owner: string | null; caption: string; files: File[] }>((resolve, reject) => { const read = db.transaction('pending').objectStore('pending').get('incoming'); read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error) })
      db.close()
      return { ok: response.ok, id: record.id, owner: record.owner, caption: record.caption, files: record.files.map(file => ({ name: file.name, size: file.size })) }
    })
    assert.equal(shared.ok, true)
    assert.equal(shared.owner, null)
    assert.equal(shared.caption, 'Incoming share fixture\nReview before sending')
    assert.deepEqual(shared.files, [{ name: 'incoming-fixture.txt', size: 7 }])
    const protectedExisting = await page.evaluate(async () => {
      const form = new FormData(); form.set('text', 'Must not overwrite a pending reviewed share')
      const response = await fetch('/share-target', { method: 'POST', body: form })
      const db = await new Promise<IDBDatabase>(resolve => { const open = indexedDB.open('jm-incoming-share-v1', 1); open.onsuccess = () => resolve(open.result) })
      const record = await new Promise<{ id: string }>(resolve => { const read = db.transaction('pending').objectStore('pending').get('incoming'); read.onsuccess = () => resolve(read.result) })
      await new Promise<void>(resolve => { const transaction = db.transaction('pending', 'readwrite'); transaction.objectStore('pending').delete('incoming'); transaction.oncomplete = () => resolve() }); db.close()
      return { id: record.id, rejected: response.url.includes('shareError=retry') }
    })
    assert.equal(protectedExisting.id, shared.id)
    assert.equal(protectedExisting.rejected, true)
    const oversized = await page.evaluate(async () => { const form = new FormData(); form.set('text', 'x'.repeat(4001)); const response = await fetch('/share-target', { method: 'POST', body: form }); return response.url.includes('shareError=limit') })
    assert.equal(oversized, true)
    checks.push('Service worker accepts bounded incoming multipart shares into separate IndexedDB for review, rejects overwrite and oversized text')
    const privateValue = await page.evaluate(async () => (await fetch('/api/pwa-private-probe')).json())
    assert.equal(privateValue.private, 'must-never-enter-cache-storage')
    assert.ok(requests.includes('/api/pwa-private-probe'))
    const cacheEntries = await page.evaluate(async () => {
      const entries: string[] = []
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) entries.push(request.url)
      return entries
    })
    assert.ok(cacheEntries.length > 10)
    assert.ok(cacheEntries.every(url => new URL(url).origin === origin && !/^\/(api|ws|files|media)(\/|$)/.test(new URL(url).pathname)))
    checks.push('API response uses network and is absent from Cache Storage')
    await page.screenshot({ path: path.join(artifacts, 'pwa-online.png'), fullPage: true })
    await context.setOffline(true)
    const offlineStarted = Date.now()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email address', { exact: true }).waitFor()
    const apiOffline = await page.evaluate(async () => { try { await fetch('/api/pwa-private-probe'); return false } catch { return true } })
    assert.equal(apiOffline, true)
    report.offlineStartupMs = Date.now() - offlineStarted
    checks.push('Cold page reload opens cached public app shell offline; private API does not fall back to shell or cached data')
    await page.screenshot({ path: path.join(artifacts, 'pwa-offline.png'), fullPage: true })
    await context.setOffline(false)
    const workerFile = path.join(fixture, 'sw.js')
    const original = fs.readFileSync(workerFile, 'utf8')
    assert.match(original, /const __JM_BUILD__ = "[a-f0-9]+"/)
    fs.writeFileSync(workerFile, original.replace(/const __JM_BUILD__ = "([a-f0-9]+)"/, 'const __JM_BUILD__ = "$1-test-update"'))
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; await reg.update() })
    await page.getByRole('button', { name: 'Reload', exact: true }).waitFor()
    assert.equal(await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting)), true)
    checks.push('New build waits and shows Reload instead of replacing an open session automatically')
    await page.getByRole('button', { name: 'Reload', exact: true }).click()
    await page.waitForFunction(async () => (await caches.keys()).some(name => name.endsWith('-test-update')))
    await page.getByLabel('Email address', { exact: true }).waitFor()
    checks.push('Explicit Reload activates updated shell')
    assert.deepEqual(errors, [])
    report.pageErrors = errors
    report.precachedRequests = cacheEntries.length
    report.status = 'passed'
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    report.error = error instanceof Error ? error.stack : String(error)
    report.previewLogs = logs
    throw error
  } finally {
    report.finishedAt = new Date().toISOString()
    fs.writeFileSync(path.join(artifacts, 'pwa-smoke.json'), JSON.stringify(report, null, 2))
    await browser?.close()
    preview.kill()
    await new Promise<void>(resolve => api.close(() => resolve()))
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
