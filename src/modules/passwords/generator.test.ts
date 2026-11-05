import { beforeEach, expect, it, vi } from 'vitest'
import { getRandomValues } from 'expo-crypto'
import { generatePassphrase, generatePassword, randomInt, SETS, WORD_COUNT, type SetName } from './generator'
vi.mock('expo-crypto', () => ({ getRandomValues: vi.fn() }))

beforeEach(() => { vi.mocked(getRandomValues).mockReset().mockImplementation(array => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(array.byteLength))
  new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes)
  return array
}) })
it('uses the reference alphabet and guarantees every selected set', () => {
  for (let i = 0; i < 16; i++) {
    const result = generatePassword()
    expect(result).toHaveLength(20)
    for (const alphabet of Object.values(SETS)) expect([...result].some(char => alphabet.includes(char))).toBe(true)
    expect([...result].every(char => Object.values(SETS).join('').includes(char))).toBe(true)
  }
})
it('clamps length to reference boundaries and applies empty-set fallback', () => {
  expect(generatePassword(0, ['digits'])).toMatch(/^[2-9]{16}$/)
  expect(generatePassword(999, ['digits'])).toMatch(/^[2-9]{64}$/)
  expect(generatePassword(17.9, ['digits'])).toHaveLength(17)
  expect(generatePassword(20, [])).toMatch(/^[a-z2-9]{20}$/)
})
it('rejects nonfinite lengths and unexpected character sets', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => generatePassword(value)).toThrow(RangeError)
    expect(() => generatePassphrase(value)).toThrow(RangeError)
  }
  expect(() => generatePassword(20, ['unknown' as SetName])).toThrow(RangeError)
})
it('uses rejection sampling instead of introducing modulo bias', () => {
  const values = [2 ** 32 - 1, 19]
  vi.mocked(getRandomValues).mockImplementation(array => { array[0] = values.shift()!; return array })
  expect(randomInt(10)).toBe(9)
  expect(getRandomValues).toHaveBeenCalledTimes(2)
})
it('validates integer random bounds and allows the full uint32 range', () => {
  for (const value of [0, -1, NaN, Infinity, 1.5, 2 ** 32 + 1]) expect(() => randomInt(value)).toThrow(RangeError)
  expect(randomInt(1)).toBe(0)
  expect(randomInt(2 ** 32)).toBeLessThan(2 ** 32)
})
it('preserves the reference word list, word count limits and two-digit suffix', () => {
  expect(WORD_COUNT).toBeGreaterThan(300)
  expect(generatePassphrase()).toMatch(/^(?:[a-z]+-){6}[1-9]\d$/)
  expect(generatePassphrase(0).split('-')).toHaveLength(5)
  expect(generatePassphrase(100).split('-')).toHaveLength(11)
})
it('fails closed when secure randomness is unavailable', () => {
  vi.mocked(getRandomValues).mockImplementation(() => { throw new Error('Secure randomness unavailable') })
  expect(() => generatePassword()).toThrow('Secure randomness unavailable')
  expect(() => generatePassphrase()).toThrow('Secure randomness unavailable')
})
