import assert = require('node:assert/strict')
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, writeFileSync } from 'node:fs'
import path = require('node:path')

// Run after signing the emulator into the isolated fixture as Universal Alice.
// Metro uses port 8081; the test-only API proxy uses 5176 -> test backend 8100.
const root = path.resolve(__dirname, '..')
const fixture = JSON.parse(readFileSync(path.join(root, 'test-results/live-fixture.json'), 'utf8')) as { conversation: string; users: { id: string; email: string; password: string }[] }
const execute = promisify(execFile)
const app = 'com.anonymous.jivojmuniversal'
const serial = process.env.JM_TEST_DEVICE || 'emulator-5554'
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function adb(...args: string[]) { return (await execute('adb', ['-s', serial, ...args], { timeout: 45000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })).stdout }
async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/jm-smoke.xml')
  const xml = await adb('exec-out', 'cat', '/sdcard/jm-smoke.xml')
  writeFileSync(path.join(root, 'test-results/native-ui.xml'), xml)
  return [...xml.matchAll(/<node\s+([^>]+)>?/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])))
}
async function waitText(text: string) {
  const until = Date.now() + 90000
  while (Date.now() < until) {
    if ((await nodes()).some(node => node.text?.includes(text) || node['content-desc']?.includes(text))) return
    await pause(1000)
  }
  throw Error(`Native screen did not show: ${text}`)
}
async function tap(label: string) {
  const all = await nodes()
  const node = all.find(item => item['content-desc'] === label) ?? all.find(item => item.text === label)
  assert.ok(node, `Native control missing: ${label}`)
  assert.notEqual(node.enabled, 'false', `Native control disabled: ${label}`)
  const bounds = node.bounds.match(/\d+/g)?.map(Number)
  assert.ok(bounds && bounds.length === 4 && bounds[2] > bounds[0] && bounds[3] > bounds[1])
  await adb('shell', 'input', 'tap', String(Math.round((bounds[0] + bounds[2]) / 2)), String(Math.round((bounds[1] + bounds[3]) / 2)))
}
async function capture(name: string) {
  await adb('shell', 'screencap', '-p', '/sdcard/jm-smoke.png')
  await adb('pull', '/sdcard/jm-smoke.png', path.join(root, `test-results/${name}.png`))
}
async function openConversation() {
  await adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `jivo-jm://messenger?conversation=${fixture.conversation}`, app)
  await waitText('Frontend Bob')
}
async function sendNative(body: string) {
  assert.match(body, /^[A-Za-z0-9 ]+$/)
  const old = (await nodes()).find(node => node['content-desc'] === 'Message')?.text ?? ''
  await tap('Message')
  if (old) {
    await adb('shell', 'input', 'keyevent', '123')
    await adb('shell', 'input', 'keyevent', ...Array.from({ length: old.length }, () => '67'))
  }
  // Pace synthetic key events on the memory-constrained emulator and verify the
  // actual field value before attributing a mismatch to message delivery.
  for (const part of body.match(/.{1,4}/g) ?? []) { await adb('shell', 'input', 'text', part.replaceAll(' ', '%s')); await pause(250) }
  const input = (await nodes()).find(node => node['content-desc'] === 'Message')
  assert.equal(input?.text, body, 'ADB did not enter the complete message')
  await adb('shell', 'input', 'keyevent', '4') // Dismiss the keyboard opened by tapping the field.
  await tap('Send message')
}
const cookies = new Map<string, string>()
const backend = 'http://127.0.0.1:8100'
async function api(route: string, body?: unknown) {
  const response = await fetch(`${backend}/api/jm${route}`, {
    signal: AbortSignal.timeout(20000),
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: backend, Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), 'Content-Type': 'application/json', 'X-CSRFToken': cookies.get('jm_csrftoken') ?? '' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]; const equals = pair.indexOf('='); cookies.set(pair.slice(0, equals), pair.slice(equals + 1)) }
  assert.ok(response.ok, `Test API ${route}: HTTP ${response.status}`)
  return response
}
interface Message { body: string; sender: { id: string } }
async function messages() { return (await (await api(`/conversations/${fixture.conversation}/messages/?limit=100`)).json() as { results: Message[] }).results }
async function delivered(body: string) {
  const until = Date.now() + 60000
  while (Date.now() < until) {
    const matches = (await messages()).filter(message => message.body === body)
    if (matches.length) { assert.equal(matches.length, 1); assert.equal(matches[0].sender.id, fixture.users[0].id); return }
    await pause(1000)
  }
  throw Error(`Native message did not reach the API: ${body}`)
}
async function main() {
  const passed: string[] = []
  const stamp = Date.now()
  await api('/auth/csrf/')
  const bob = fixture.users[1]
  await api('/auth/login/', { email: bob.email, password: bob.password })
  try {
    await waitText('Sign out'); await openConversation()
    const outgoing = `Native live ${stamp}`
    await sendNative(outgoing); await delivered(outgoing)
    passed.push('native send reaches the other account exactly once'); console.log(passed.at(-1))
    const incoming = `Backend live ${stamp}`
    await api(`/conversations/${fixture.conversation}/messages/`, { client_id: crypto.randomUUID(), body: incoming, upload_ids: [] })
    await waitText(incoming); await capture('native-live-chat')
    passed.push('incoming message appears without manual refresh'); console.log(passed.at(-1))
    await adb('reverse', '--remove', 'tcp:5176')
    const queued = `Native queued ${stamp}`
    await sendNative(queued); await waitText(queued); await pause(3000)
    assert.equal((await messages()).filter(message => message.body === queued).length, 0)
    await capture('native-offline-queue')
    await adb('shell', 'am', 'force-stop', app)
    await adb('reverse', 'tcp:5176', 'tcp:5176')
    await adb('shell', 'am', 'start', '-n', `${app}/.MainActivity`)
    await waitText('Sign out'); await delivered(queued); await openConversation()
    await waitText(queued); await capture('native-restored-queue')
    passed.push('cookie session and protected queued send survive process restart; delivered once after reconnect'); console.log(passed.at(-1))
    await tap('Sign out'); await waitText('Sign in')
    passed.push('native sign-out returns to login')
    const result = { at: new Date().toISOString(), device: serial, passed }
    writeFileSync(path.join(root, 'test-results/native-smoke.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally {
    await adb('reverse', 'tcp:5176', 'tcp:5176')
    await api('/auth/logout/', {})
  }
}
main().catch(async error => { console.error(error); await capture('native-failure').catch(() => {}); process.exitCode = 1 })
