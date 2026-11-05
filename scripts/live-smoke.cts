import { chromium, expect, type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import path = require('node:path')

const root = path.resolve(__dirname, '..')
const fixture = JSON.parse(readFileSync(path.join(root, 'test-results/live-fixture.json'), 'utf8')) as {
  conversation: string; users: { id: string; email: string; password: string }[]
}
const universal = 'http://127.0.0.1:5176'
const reference = 'http://127.0.0.1:5177'
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const a = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  const b = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  const first = await a.newPage(); const second = await b.newPage()
  await second.addLocatorHandler(second.getByRole('button', { name: 'Not now', exact: true }).first(), async locator => { await locator.click() }, { noWaitAfter: true })
  first.setDefaultNavigationTimeout(120000); second.setDefaultNavigationTimeout(120000)
  const errors: string[] = []
  first.on('pageerror', error => errors.push(error.message))
  second.on('pageerror', error => errors.push(error.message))
  const runId = Date.now().toString()
  try {
    await first.goto(`${universal}/login`, { waitUntil: 'domcontentloaded' })
    await first.getByLabel(/^(Email|JIVO email)$/).fill(fixture.users[0].email)
    await first.getByLabel('Password', { exact: true }).fill(fixture.users[0].password)
    await first.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(first.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible({ timeout: 30000 })
    await second.goto(`${reference}/login`, { waitUntil: 'domcontentloaded' })
    await second.getByLabel('Email', { exact: true }).fill(fixture.users[1].email)
    await second.getByLabel('Password', { exact: true }).fill(fixture.users[1].password)
    await second.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(second).not.toHaveURL(/\/login/, { timeout: 30000 })
    await first.goto(`${universal}/messenger?conversation=${fixture.conversation}`)
    await second.goto(`${reference}/messenger/${fixture.conversation}`)
    // Dismiss the original web app's first-run install/notification prompts through its UI.
    for (let prompt = 0; prompt < 3; prompt++) {
      const later = second.getByRole('button', { name: 'Not now', exact: true }).first()
      try { await later.waitFor({ state: 'visible', timeout: 2000 }) } catch { break }
      await later.click()
    }
    await expect(first.getByLabel('Message', { exact: true })).toBeVisible({ timeout: 30000 })
    await expect(second.getByLabel('Message', { exact: true })).toBeVisible({ timeout: 30000 })
    const outgoing = `Universal live ${runId}`
    await first.getByLabel('Message', { exact: true }).fill(outgoing)
    await first.getByRole('button', { name: 'Send message', exact: true }).click()
    await expect(second.getByText(outgoing, { exact: true }).last()).toBeVisible({ timeout: 20000 })
    const incoming = `Frontend live ${runId}`
    await second.getByLabel('Message', { exact: true }).fill(incoming)
    await second.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(first.getByText(incoming, { exact: true }).last()).toBeVisible({ timeout: 20000 })
    // Disconnect the Universal browser, send from the original web client, then verify REST catch-up.
    await a.setOffline(true)
    const missed = `Reconnect live ${runId}`
    await second.getByLabel('Message', { exact: true }).fill(missed)
    await second.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(second.getByText(missed, { exact: true }).last()).toBeVisible()
    await a.setOffline(false)
    await expect(first.getByText(missed, { exact: true }).last()).toBeVisible({ timeout: 30000 })
    const result = { at: new Date().toISOString(), passed: ['both real login UIs', 'Universal to Frontend live message', 'Frontend to Universal live message', 'offline reconnect catch-up'], pageErrors: errors }
    expect(errors).toEqual([])
    writeFileSync(path.join(root, 'test-results/live-smoke.json'), JSON.stringify(result, null, 2))
    await first.screenshot({ path: path.join(root, 'test-results/live-universal.png') })
    await second.screenshot({ path: path.join(root, 'test-results/live-frontend.png') })
    console.log(JSON.stringify(result))
  } catch (error) {
    for (const [name, page] of [['universal', first], ['frontend', second]] as [string, Page][]) {
      console.log(name, (await page.locator('body').innerText()).slice(0, 1500))
      await page.screenshot({ path: path.join(root, `test-results/live-${name}-failed.png`) })
    }
    throw error
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

