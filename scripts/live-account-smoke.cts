import { chromium, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path = require('node:path')

// Explicitly supplied test credentials stay in process memory. Writes are limited
// to labeled messages in self chat or between the two supplied test accounts.
const email = process.env.JM_SMOKE_EMAIL
const password = process.env.JM_SMOKE_PASSWORD
const secondEmail = process.env.JM_SMOKE_SECOND_EMAIL
const secondPassword = process.env.JM_SMOKE_SECOND_PASSWORD
const base = process.env.JM_SMOKE_URL || 'http://127.0.0.1:4176'
const root = path.resolve(__dirname, '..')
async function api(page: Page, route: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ route, method, body }) => {
    const csrf = document.cookie.split('; ').find(value => value.startsWith('jm_csrftoken='))?.split('=').slice(1).join('=') || ''
    const response = await fetch('/api/jm' + route, { method, headers: { 'Content-Type': 'application/json', 'X-CSRFToken': decodeURIComponent(csrf) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: response.status === 204 ? null : await response.json() }
  }, { route, method, body })
}
async function main() {
  if (!email || !password) throw Error('Set JM_SMOKE_EMAIL and JM_SMOKE_PASSWORD for an authorized test account.')
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('This test requires a local preview.')
  mkdirSync(path.join(root, 'test-results'), { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' })))
  const pages = await Promise.all(contexts.map(context => context.newPage()))
  const checks: string[] = [], errors: string[] = [], sentIds = new Map<string, number>(), frames = [new Set<string>(), new Set<string>()]
  const prefix = 'JM Universal verification ' + Date.now()
  let conversation = ''
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), scope: secondEmail ? 'Real backend; two authorized accounts; direct conversation' : 'Real backend; two independent browser sessions of one authorized account; self chat only', status: 'failed', checks }
  for (const [index, page] of pages.entries()) {
    page.on('pageerror', error => errors.push(error.message))
    page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
      try { const frame = JSON.parse(String(payload)); if (frame.type === 'HELLO') frames[index].add('HELLO'); if (frame.type === 'MESSAGE_CREATED' && frame.data?.body?.startsWith(prefix)) frames[index].add(frame.data.body) } catch { /* non-JSON frames are not evidence */ }
    }))
    page.on('response', response => {
      if (response.request().method() === 'POST' && /\/conversations\/[^/]+\/messages\/$/.test(new URL(response.url()).pathname) && response.ok()) {
        void response.json().then(value => { if (value.body?.startsWith(prefix) && value.id) sentIds.set(value.id, index) }).catch(() => {})
      }
    })
  }
  try {
    for (const [index, page] of pages.entries()) {
      await page.goto(base + '/login')
      expect((await api(page, '/auth/csrf/')).status).toBe(204)
      await page.getByLabel(/^(Email|JIVO email)$/).fill(index === 1 && secondEmail ? secondEmail : email)
      await page.getByLabel('Password', { exact: true }).fill(index === 1 && secondPassword ? secondPassword : password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible({ timeout: 30000 })
      // Exercise the real first-run prompt before navigating or going offline.
      await page.getByRole('button', { name: 'Not now', exact: true }).waitFor({ timeout: 10000 })
      await page.getByRole('button', { name: 'Not now', exact: true }).click()
      await expect(page.getByText('Install JIVO JM', { exact: true })).toHaveCount(0)
    }
    checks.push('Both real login UIs succeed; CSRF204 accepted'); console.log('PASS real sign-in in both sessions')
    const identity = await api(pages[0], '/me/')
    expect(identity.status).toBe(200)
    const recipient = await api(pages[1], '/me/')
    expect(recipient.status).toBe(200)
    const own = await api(pages[0], '/conversations/direct/', 'POST', { user_id: recipient.data.id })
    expect(own.status).toBeGreaterThanOrEqual(200); expect(own.status).toBeLessThan(300)
    expect(Boolean(own.data.is_self)).toBe(!secondEmail)
    conversation = own.data.id
    if (process.env.JM_SMOKE_CLEAN_SINCE && Number.isFinite(Date.parse(process.env.JM_SMOKE_CLEAN_SINCE))) {
      const old = await api(pages[0], '/conversations/' + conversation + '/messages/?limit=100')
      let cleaned = 0
      for (const message of old.data.results ?? []) {
        const match = /^JM Universal verification (\d+) (live|catch-up|offline queue)$/.exec(message.body || '')
        if (!match || Number(match[1]) < Date.parse(process.env.JM_SMOKE_CLEAN_SINCE!) || Number(match[1]) >= Number(prefix.split(' ').at(-1))) continue
        const author = message.sender?.id === identity.data.id ? 0 : message.sender?.id === recipient.data.id ? 1 : -1
        if (author < 0) continue
        const removed = await api(pages[author], '/messages/' + message.id + '/?for=everyone', 'DELETE')
        if (removed.status >= 200 && removed.status < 300) cleaned++
      }
      report.interruptedTestMessagesRemoved = cleaned
    }
    for (const page of pages) {
      await page.goto(base + '/messenger?conversation=' + encodeURIComponent(conversation))
      await expect(page.getByLabel('Message', { exact: true })).toBeVisible({ timeout: 30000 })
    }
    await expect.poll(() => frames.every(set => set.has('HELLO')), { timeout: 20000 }).toBe(true)
    checks.push('Authenticated WebSocket HELLO in both sessions; authorized conversation opened')
    const send = async (page: Page, text: string) => { await page.getByLabel('Message', { exact: true }).fill(text); await page.getByRole('button', { name: 'Send message', exact: true }).click() }
    const live = prefix + ' live'
    await send(pages[0], live)
    await expect(pages[1].getByLabel(/^(Latest messages|Message history)$/).getByText(live, { exact: true })).toBeVisible({ timeout: 30000 })
    await expect.poll(() => frames[1].has(live)).toBe(true)
    checks.push('UI send reaches second session through real MESSAGE_CREATED WebSocket'); console.log('PASS live WebSocket message')
    await contexts[0].setOffline(true)
    const missed = prefix + ' catch-up', queued = prefix + ' offline queue'
    console.log('Checking reconnect catch-up and offline queue'); await send(pages[1], missed)
    await expect(pages[1].getByLabel(/^(Latest messages|Message history)$/).getByText(missed, { exact: true })).toBeVisible({ timeout: 30000 })
    await send(pages[0], queued)
    await expect(pages[0].getByRole('button', { name: 'Discard queued message', exact: true })).toBeVisible()
    await contexts[0].setOffline(false)
    await expect(pages[0].getByLabel(/^(Latest messages|Message history)$/).getByText(missed, { exact: true })).toBeVisible({ timeout: 45000 })
    await expect(pages[1].getByLabel(/^(Latest messages|Message history)$/).getByText(queued, { exact: true })).toBeVisible({ timeout: 45000 })
    await expect(pages[0].getByRole('button', { name: 'Discard queued message', exact: true })).toHaveCount(0, { timeout: 45000 })
    const history = await api(pages[0], '/conversations/' + conversation + '/messages/?limit=100')
    expect(history.status).toBe(200)
    const messages = history.data.messages ?? history.data.results
    for (const text of [live, missed, queued]) expect(messages.filter((message: { body: string }) => message.body === text)).toHaveLength(1)
    for (const message of messages) if (message.body?.startsWith(prefix)) sentIds.set(message.id, message.sender?.id === recipient.data.id && secondEmail ? 1 : 0)
    checks.push('Reconnect catches missed message and flushes offline queue; backend contains each test message exactly once')
    await pages[0].reload()
    await expect(pages[0].getByLabel(/^(Latest messages|Message history)$/).getByText(queued, { exact: true })).toBeVisible({ timeout: 30000 })
    checks.push('Session and conversation restore after reload')
    expect(errors).toEqual([])
    report.status = 'passed'
  } catch (error) {
    const redact = (value: string) => [email, password, secondEmail, secondPassword].filter((secret): secret is string => Boolean(secret)).reduce((result, secret) => result.replaceAll(secret, '[redacted]'), value)
    report.error = error instanceof Error ? redact(error.message) : 'Live verification failed'
    report.loginAlerts = (await pages[0].getByRole('alert').allTextContents()).map(redact)
    await pages[0].screenshot({ path: path.join(root, 'test-results/live-account-failure.png') }).catch(() => {})
    report.twoStepRequested = await pages[0].getByText('Two-step verification', { exact: true }).count() > 0
    throw error
  } finally {
    await contexts[0].setOffline(false)
    let removed = 0
    for (const [id, author] of sentIds) {
      try { const result = await api(pages[author], '/messages/' + encodeURIComponent(id) + '/?for=everyone', 'DELETE'); if (result.status >= 200 && result.status < 300) removed++ } catch { /* report incomplete cleanup */ }
    }
    report.testMessagesCreated = sentIds.size; report.testMessagesRemoved = removed
    if (removed !== sentIds.size) report.cleanup = 'Some labeled test messages remain in the test conversation'
    for (const page of pages) { try { await api(page, '/auth/logout/', 'POST', {}) } catch { /* browser session still destroyed below */ } }
    report.pageErrors = errors; report.finishedAt = new Date().toISOString()
    writeFileSync(path.join(root, 'test-results/live-account-smoke.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    await browser.close()
  }
}
void main().catch(() => { process.exitCode = 1 })
