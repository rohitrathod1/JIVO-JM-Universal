import assert = require('node:assert/strict')
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, writeFileSync } from 'node:fs'
import path = require('node:path')

// Native smoke on an Android EMULATOR, run after signing the app into the test backend as the first account (Alice).
// Nothing is hardcoded: pass the backend and the accounts file (AND-NOTE-02), e.g. for the isolated e2e backend
//   npx tsx scripts/native-smoke.cts --backend http://127.0.0.1:8010 --accounts <E2E>/accounts.json --device emulator-5554
// Options (or env): --backend (JM_SMOKE_BACKEND) test backend origin; --accounts (JM_SMOKE_ACCOUNTS) either the e2e
// accounts.json (alice/bob + conversations.direct_alice_bob) or the older live-fixture.json shape; --device (JM_TEST_DEVICE,
// default emulator-5554); --api-port (JM_SMOKE_API_PORT, default the backend's port) is the device port the app's
// EXPO_PUBLIC_API_ORIGIN uses. The script toggles `adb reverse tcp:<api-port> tcp:<api-port>` to simulate offline.
const root = path.resolve(__dirname, '..')
const execute = promisify(execFile)
const app = 'com.anonymous.jivojmuniversal'
function option(name: string, env: string) {
  const at = process.argv.indexOf(`--${name}`)
  const inline = process.argv.find(arg => arg.startsWith(`--${name}=`))
  return (at >= 0 ? process.argv[at + 1] : inline?.slice(name.length + 3)) || process.env[env] || ''
}
function usage(problem: string): never {
  console.error(`${problem}
Usage: npx tsx scripts/native-smoke.cts --backend http://127.0.0.1:8010 --accounts <accounts.json> [--device emulator-5554] [--api-port 8010]`)
  process.exit(2)
}
interface Fixture { conversation: string; sender: { id: string }; peer: { email: string; password: string } }
/** Accepts the e2e accounts.json ({accounts: {alice, bob}, conversations: {direct_alice_bob}}) or live-fixture.json ({conversation, users: [alice, bob]}). */
function loadFixture(file: string): Fixture {
  const raw = JSON.parse(readFileSync(path.resolve(file), 'utf8'))
  if (raw.accounts?.alice && raw.accounts?.bob && raw.conversations?.direct_alice_bob?.public_id)
    return { conversation: raw.conversations.direct_alice_bob.public_id, sender: { id: raw.accounts.alice.public_id }, peer: raw.accounts.bob }
  if (typeof raw.conversation === 'string' && Array.isArray(raw.users) && raw.users.length >= 2)
    return { conversation: raw.conversation, sender: { id: raw.users[0].id }, peer: raw.users[1] }
  return usage(`Unrecognised accounts file: ${file}`)
}
const backendArg = option('backend', 'JM_SMOKE_BACKEND') || usage('Missing --backend (or JM_SMOKE_BACKEND).')
const accountsArg = option('accounts', 'JM_SMOKE_ACCOUNTS') || usage('Missing --accounts (or JM_SMOKE_ACCOUNTS).')
const backendUrl = new URL(backendArg)
// Test backends only: loopback, never the developer backend on 8000 (or Metro 8081).
if (!['127.0.0.1', 'localhost'].includes(backendUrl.hostname) || ['8000', '8081'].includes(backendUrl.port) || !backendUrl.port) usage(`Refusing backend ${backendArg}: use a loopback test backend such as http://127.0.0.1:8010.`)
const backend = backendUrl.origin
const apiPort = option('api-port', 'JM_SMOKE_API_PORT') || backendUrl.port
if (!/^\d{2,5}$/.test(apiPort) || ['8000', '8081'].includes(apiPort)) usage(`Refusing --api-port ${apiPort}.`)
const reverse = `tcp:${apiPort}`
const serial = option('device', 'JM_TEST_DEVICE') || 'emulator-5554'
// Emulators only: the USB phone must never be driven by this script.
if (!/^emulator-\d+$/.test(serial)) usage(`Refusing device ${serial}: run against an emulator (emulator-NNNN).`)
const fixture = loadFixture(accountsArg)
let peerName = ''
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
  await waitText(peerName)
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
    if (matches.length) { assert.equal(matches.length, 1); assert.equal(matches[0].sender.id, fixture.sender.id); return }
    await pause(1000)
  }
  throw Error(`Native message did not reach the API: ${body}`)
}
async function main() {
  const passed: string[] = []
  const stamp = Date.now()
  await api('/auth/csrf/')
  await api('/auth/login/', { email: fixture.peer.email, password: fixture.peer.password })
  // The direct chat header on the device shows the peer's name.
  const peer = await (await api('/me/')).json() as { name?: string; display_name?: string; full_name?: string }
  peerName = peer.display_name || peer.name || peer.full_name || ''
  assert.ok(peerName, 'Test API /me/ returned no name for the peer account')
  try {
    await waitText('Sign out'); await openConversation()
    const outgoing = `Native live ${stamp}`
    await sendNative(outgoing); await delivered(outgoing)
    passed.push('native send reaches the other account exactly once'); console.log(passed.at(-1))
    const incoming = `Backend live ${stamp}`
    await api(`/conversations/${fixture.conversation}/messages/`, { client_id: crypto.randomUUID(), body: incoming, upload_ids: [] })
    await waitText(incoming); await capture('native-live-chat')
    passed.push('incoming message appears without manual refresh'); console.log(passed.at(-1))
    await adb('reverse', '--remove', reverse)
    const queued = `Native queued ${stamp}`
    await sendNative(queued); await waitText(queued); await pause(3000)
    assert.equal((await messages()).filter(message => message.body === queued).length, 0)
    await capture('native-offline-queue')
    await adb('shell', 'am', 'force-stop', app)
    await adb('reverse', reverse, reverse)
    await adb('shell', 'am', 'start', '-n', `${app}/.MainActivity`)
    await waitText('Sign out'); await delivered(queued); await openConversation()
    await waitText(queued); await capture('native-restored-queue')
    passed.push('cookie session and protected queued send survive process restart; delivered once after reconnect'); console.log(passed.at(-1))
    await tap('Sign out'); await waitText('Sign in')
    passed.push('native sign-out returns to login')
    const result = { at: new Date().toISOString(), device: serial, backend, apiPort: Number(apiPort), passed }
    writeFileSync(path.join(root, 'test-results/native-smoke.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally {
    await adb('reverse', reverse, reverse)
    await api('/auth/logout/', {})
  }
}
main().catch(async error => { console.error(error); await capture('native-failure').catch(() => {}); process.exitCode = 1 })
