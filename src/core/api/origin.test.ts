import { describe, expect, it } from 'vitest'
import { resolveApiOrigin } from './origin'

describe('API origin across platforms', () => {
  it('keeps web requests on the deployed origin even with a local native .env', () => {
    expect(resolveApiOrigin('web', 'http://127.0.0.1:8000', 'https://jm.example.test')).toBe('https://jm.example.test')
    expect(resolveApiOrigin('web', undefined, 'http://127.0.0.1:5175')).toBe('http://127.0.0.1:5175')
  })
  it('does not make web requests to the native backend while rendering without a browser', () => {
    expect(resolveApiOrigin('web', 'http://127.0.0.1:8000')).toBe('')
    expect(resolveApiOrigin('web', 'http://127.0.0.1:8000', 'null')).toBe('')
  })
  it('preserves configured Android and iOS development origins', () => {
    expect(resolveApiOrigin('android', 'http://10.0.2.2:8000/', 'http://localhost')).toBe('http://10.0.2.2:8000')
    expect(resolveApiOrigin('ios', 'https://jm.example.test')).toBe('https://jm.example.test')
    expect(resolveApiOrigin('android')).toBe('')
  })
})
