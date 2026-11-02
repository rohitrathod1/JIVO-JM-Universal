import assert = require('node:assert/strict')
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFileSync } from 'node:fs'
import path = require('node:path')

// Run with an already signed-in emulator and explicitly authorized account envs.
const run = promisify(execFile)
const root = path.resolve(__dirname, '..')
const adbPath = path.join(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA!, 'Android', 'Sdk'), 'platform-tools', 'adb.exe')
const serial = process.env.JM_TEST_DEVICE || 'emulator-5554'
const app = 'com.anonymous.jivojmuniversal'
const origin = 'http://127.0.0.1:8000'
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function adb(...args: string[]) { return (await run(adbPath, ['-s', serial, ...args], { windowsHide: true, timeout: 45000, maxBuffer: 4 * 1024 * 1024 })).stdout }
async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/jm-final-check.xml')
  const xml = await adb('exec-out', 'cat', '/sdcard/jm-final-check.xml')
  return [...xml.matchAll(/<node\s+([^>]+)>?/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])))
}
async function waitFor(predicate: (all: Record<string, string>[]) => boolean) {
  const until = Date.now() + 90000
  while (Date.now() < until) { if (predicate(await nodes())) return; await pause(1000) }
  throw Error('Expected native screen did not become ready')
}
async function tap(label: string) {
  const node = (await nodes()).find(value => value['content-desc'] === label || value.text === label)
  assert.ok(node && node.enabled !== 'false', 'Native control missing or disabled: ' + label)
  const bounds = node.bounds.match(/\d+/g)!.map(Number)
  await adb('shell', 'input', 'tap', String(Math.round((bounds[0] + bounds[2]) / 2)), String(Math.round((bounds[1] + bounds[3]) / 2)))
}
class Client {
  cookies = new Map<string, string>()
  async call(route: string, method = 'GET', body?: unknown) {
    const response = await fetch(origin + '/api/jm' + route, { method, signal: AbortSignal.timeout(20000), headers: { Origin: origin, Cookie: [...this.cookies].map(([key, value]) => key + '=' + value).join('; '), 'Content-Type': 'application/json', 'X-CSRFToken': this.cookies.get('jm_csrftoken') || '' }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], index = pair.indexOf('='); this.cookies.set(pair.slice(0, index), pair.slice(index + 1)) }
    assert.ok(response.ok, 'Test API returned HTTP ' + response.status)
    return response.status === 204 ? null : response.json()
  }
}
async function main() {
  const email = process.env.JM_SMOKE_EMAIL, password = process.env.JM_SMOKE_PASSWORD, secondEmail = process.env.JM_SMOKE_SECOND_EMAIL, secondPassword = process.env.JM_SMOKE_SECOND_PASSWORD
  assert.ok(email && password && secondEmail && secondPassword, 'Supply authorized test credentials in the process environment')
  const first = new Client(), second = new Client()
  const prefix = 'JM native verification ' + Date.now()
  const sent = new Map<string, Client>(), checks: string[] = []
  let conversation = ''
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), status: 'failed', scope: 'Final x86_64 APK with current Metro source; real two-account backend; native UI and second account API', checks }
  try {
    await adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'jivo-jm://profile', app)
    await waitFor(all => all.some(value => value.text === email))
    checks.push('Final installed APK restores the expected account and current native profile')
    for (const [client, address, secret] of [[first, email, password], [second, secondEmail, secondPassword]] as const) { await client.call('/auth/csrf/'); await client.call('/auth/login/', 'POST', { email: address, password: secret }) }
    const me = await first.call('/me/'), peer = await second.call('/me/')
    const detail = await first.call('/conversations/direct/', 'POST', { user_id: peer.id })
    conversation = detail.id
    await adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'jivo-jm://messenger?conversation=' + conversation, app)
    await waitFor(all => all.some(value => value['content-desc'] === 'Message'))
    const composer = (await nodes()).find(value => value['content-desc'] === 'Message')!
    assert.ok(!composer.text || composer.text === 'Message', 'Existing native draft preserved; test stopped before editing it')
    const outgoing = prefix + ' outgoing'
    await tap('Message')
    for (const part of outgoing.match(/.{1,4}/g) ?? []) { await adb('shell', 'input', 'text', part.replaceAll(' ', '%s')); await pause(200) }
    assert.equal((await nodes()).find(value => value['content-desc'] === 'Message')?.text, outgoing, 'ADB entered incomplete text')
    await adb('shell', 'input', 'keyevent', '4')
    await tap('Send message')
    let delivered = false
    for (let i = 0; i < 20; i++) {
      const history = await second.call('/conversations/' + conversation + '/messages/?limit=100')
      const matches = history.results.filter((value: { body: string }) => value.body === outgoing)
      if (matches.length) { assert.equal(matches.length, 1); assert.equal(matches[0].sender.id, me.id); sent.set(matches[0].id, first); delivered = true; break }
      await pause(1000)
    }
    assert.ok(delivered, 'Native outgoing message was not received by the other account')
    checks.push('Native composer sends to the authorized second account; backend records one copy')
    const incoming = prefix + ' incoming'
    const reply = await second.call('/conversations/' + conversation + '/messages/', 'POST', { client_id: crypto.randomUUID(), body: incoming, attachment_ids: [], mentions: [] })
    sent.set(reply.id, second)
    await waitFor(all => all.some(value => value.text?.includes(incoming)))
    checks.push('Second-account message appears in the open native conversation without manual refresh')
    report.status = 'passed'
  } catch (error) { report.error = [email, password, secondEmail, secondPassword].reduce((message, secret) => message.replaceAll(secret, '[redacted]'), error instanceof Error ? error.message : 'Native check failed'); process.exitCode = 1 }
  finally {
    // Recover a successfully sent native message even if a later UI assertion failed.
    if (conversation) try { const history = await first.call('/conversations/' + conversation + '/messages/?limit=100'); for (const message of history.results) if (message.body?.startsWith(prefix) && !sent.has(message.id)) sent.set(message.id, first) } catch { /* recorded below */ }
    let removed = 0
    for (const [id, author] of sent) try { await author.call('/messages/' + id + '/?for=everyone', 'DELETE'); removed++ } catch { /* recorded below */ }
    report.testMessagesCreated = sent.size; report.testMessagesRemoved = removed
    if (removed !== sent.size) { report.status = 'failed'; process.exitCode = 1 }
    for (const client of [first, second]) try { await client.call('/auth/logout/', 'POST', {}) } catch { /* native session remains intentionally signed in */ }
    await adb('shell', 'screencap', '-p', '/sdcard/jm-final-check.png').catch(() => {})
    await adb('pull', '/sdcard/jm-final-check.png', path.join(root, 'test-results/native-account-final.png')).catch(() => {})
    report.finishedAt = new Date().toISOString()
    writeFileSync(path.join(root, 'test-results/native-account-final.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  }
}
void main().catch(() => { console.error('Native test setup failed'); process.exitCode = 1 })
