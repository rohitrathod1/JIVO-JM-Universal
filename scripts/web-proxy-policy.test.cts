import { test } from 'node:test'
import assert = require('node:assert/strict')
import { loopbackOrigin, socketOrigin } from './web-proxy-policy.cts'
test('the proxy accepts only loopback origins without credentials or paths', () => {
  assert.equal(loopbackOrigin('http://127.0.0.1:8000/'), 'http://127.0.0.1:8000')
  for (const value of ['http://evil.test', 'http://127.0.0.1:8000/path', 'http://user:pass@127.0.0.1:8000', 'http://127.0.0.1:8000#fragment']) assert.throws(() => loopbackOrigin(value))
})
test('foreign or missing WebSocket origins cannot borrow the trusted upstream origin', () => {
  const app = 'http://127.0.0.1:5175'; const upstream = 'http://127.0.0.1:8000'
  assert.equal(socketOrigin(app, app, upstream), upstream)
  for (const value of [undefined, 'null', 'https://evil.test', 'http://127.0.0.1:5174', app + '.evil.test']) assert.equal(socketOrigin(value, app, upstream), null)
})
