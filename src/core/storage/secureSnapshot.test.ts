import { expect, it } from 'vitest'
import { SecureSnapshot, type SecureValues } from './secureSnapshot'

function fixture() {
  const data = new Map<string, string>()
  let counter = 0
  let fail = false
  const values: SecureValues = {
    get: async key => data.get(key) ?? null,
    set: async (key, value) => { if (fail && key.endsWith('.1')) throw Error('disk full'); data.set(key, value) },
    remove: async key => { data.delete(key) },
  }
  return { data, values, create: () => new SecureSnapshot(values, 'test', () => `v${++counter}`), fail: () => { fail = true } }
}
it('restores Unicode messages across restarts without oversized keychain records', async () => {
  const f = fixture(); const text = 'hello 😃 नमस्ते '.repeat(500)
  await f.create().write(text)
  expect(await f.create().read()).toBe(text)
  expect([...f.data.values()].every(value => new TextEncoder().encode(value).length < 2048)).toBe(true)
})
it('recovers the previous snapshot after an interrupted write and removes staging chunks', async () => {
  const f = fixture(); await f.create().write('original'); f.fail()
  await expect(f.create().write('x'.repeat(1000))).rejects.toThrow('disk full')
  expect(await f.create().read()).toBe('original')
  expect([...f.data.keys()].filter(key => key.includes('v2'))).toEqual([])
})
it('serializes concurrent writes and clears all owned records on logout', async () => {
  const f = fixture(); const store = f.create()
  await Promise.all([store.write('first'), store.write('second')])
  expect(await store.read()).toBe('second')
  await store.clear(); expect(f.data.size).toBe(0); expect(await f.create().read()).toBeNull()
})
it('fails closed if a committed chunk is missing', async () => {
  const f = fixture(); await f.create().write('content'); f.data.delete('test.v1.0')
  await expect(f.create().read()).rejects.toThrow('incomplete')
})

it.each(['null', '{}', '{"current":false,"garbage":null}', '{"current":{"id":3,"chunks":1},"garbage":null}'])('rejects malformed storage metadata: %s', async raw => {
  const f = fixture(); f.data.set('test', raw)
  await expect(f.create().read()).rejects.toThrow('Invalid protected storage manifest')
})
