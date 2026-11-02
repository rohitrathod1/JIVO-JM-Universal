import assert = require('node:assert/strict')
import { EventEmitter } from 'node:events'
import { readFileSync, writeFileSync } from 'node:fs'
import path = require('node:path')

// Uses only the synthetic fixture prepared in the isolated test database.
const root = path.resolve(__dirname, '..')
const fixture = JSON.parse(readFileSync(path.join(root, 'test-results/live-fixture.json'), 'utf8')) as { users: { email: string; password: string }[] }
const origin = 'http://127.0.0.1:5176'
interface Socket extends EventEmitter { close(): void; terminate(): void }
const SocketClient = require('ws') as new (url: string, options: { origin: string; headers: Record<string, string> }) => Socket
const cookies = new Map<string, string>()
const cookieHeader = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ')
async function call(route: string, body?: unknown) {
  const response = await fetch(`${origin}/api/jm${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, Cookie: cookieHeader(), 'Content-Type': 'application/json', 'X-CSRFToken': cookies.get('jm_csrftoken') ?? '' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]; const equals = pair.indexOf('=')
    cookies.set(pair.slice(0, equals), pair.slice(equals + 1))
  }
  return response
}
async function socketCheck(requestOrigin: string, allowed: boolean) {
  return new Promise<void>((resolve, reject) => {
    const socket = new SocketClient(`${origin.replace('http:', 'ws:')}/ws/`, { origin: requestOrigin, headers: { Cookie: cookieHeader() } })
    const timer = setTimeout(() => { socket.terminate(); reject(Error('WebSocket verification timed out')) }, 15000)
    let settled = false
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); socket.close(); if (error) reject(error); else resolve() }
    socket.on('open', () => { if (!allowed) finish(Error('Foreign origin was accepted')) })
    socket.on('message', (raw: Buffer) => {
      try { if (JSON.parse(raw.toString()).type === 'HELLO') finish() } catch (error) { finish(error as Error) }
    })
    socket.on('error', (error: Error) => finish(allowed ? error : undefined))
    socket.on('close', () => finish(allowed ? Error('Socket closed before HELLO') : undefined))
  })
}
async function main() {
  assert.equal((await call('/auth/csrf/')).status, 204)
  assert.ok(cookies.get('jm_csrftoken'))
  assert.equal((await call('/auth/login/', fixture.users[0])).status, 200)
  assert.equal((await call('/me/')).status, 200)
  await socketCheck(origin, true)
  await socketCheck('https://foreign.example', false)
  assert.equal((await call('/auth/logout/', {})).status, 204)
  const result = { at: new Date().toISOString(), passed: ['proxy CSRF cookie initialization', 'proxy cookie sign-in', 'authenticated WebSocket HELLO', 'foreign WebSocket origin rejected', 'sign-out'] }
  writeFileSync(path.join(root, 'test-results/live-proxy-smoke.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
