import { describe, expect, it } from 'vitest'
import { canSubmitToken, identityFromOptions, localIdentity, peopleStatuses, safeWebUrl, tokenPageMode } from './identityModel'
import { safeMailHref } from '../../modules/profile/contact'

describe('identity from /auth/options/', () => {
  it('stays local when the server says nothing new', () => {
    expect(identityFromOptions(null)).toEqual(localIdentity)
    expect(identityFromOptions({ passkey_sign_in: true })).toEqual({ jivo: false, passwordResetUrl: null, passkeySignIn: true, canChangePassword: true, canChangeName: false })
    expect(identityFromOptions({ passkey_sign_in: false, identity: 'local', password_reset_url: 'https://auth.example.invalid/forgot-password/' }).passwordResetUrl).toBeNull()
  })
  it('reads Jivo Auth and keeps only a web reset address', () => {
    expect(identityFromOptions({ passkey_sign_in: false, identity: 'jivo', password_reset_url: 'https://auth.example.invalid/forgot-password/' }))
      .toEqual({ jivo: true, passwordResetUrl: 'https://auth.example.invalid/forgot-password/', passkeySignIn: false, canChangePassword: false, canChangeName: false })
    expect(identityFromOptions({ identity: 'jivo', password_reset_url: 'javascript:alert(1)' }).passwordResetUrl).toBeNull()
    expect(identityFromOptions({ identity: 'jivo', password_reset_url: null }).passwordResetUrl).toBeNull()
  })
  it('rejects non-web and malformed addresses', () => {
    for (const bad of ['', 'intent://x', 'data:text/html,x', 'https://', 'https://a b', 42]) expect(safeWebUrl(bad)).toBeNull()
    expect(safeWebUrl(' http://auth.example.invalid/x ')).toBe('http://auth.example.invalid/x')
  })
})

describe('invitation and reset page', () => {
  it('picks the mode from the token check', () => {
    expect(tokenPageMode(null)).toBe('loading')
    expect(tokenPageMode({ valid: true, email: 'a@example.invalid' })).toBe('set-password')
    expect(tokenPageMode({ valid: true, identity: 'local' })).toBe('set-password')
    expect(tokenPageMode({ valid: true, identity: 'jivo' })).toBe('jivo-sign-in')
    expect(tokenPageMode({ valid: false, code: 'managed_by_jivo_auth' })).toBe('managed-by-jivo')
    expect(tokenPageMode({ valid: false })).toBe('invalid')
  })
  it('needs one JIVO password, or a new password typed twice', () => {
    expect(canSubmitToken('jivo-sign-in', 'secret', '')).toBe(true)
    expect(canSubmitToken('jivo-sign-in', '', '')).toBe(false)
    expect(canSubmitToken('set-password', 'secret', '')).toBe(false)
    expect(canSubmitToken('set-password', 'secret', 'secret')).toBe(true)
    expect(canSubmitToken('invalid', 'secret', 'secret')).toBe(false)
    expect(canSubmitToken('managed-by-jivo', 'secret', 'secret')).toBe(false)
  })
})

describe('Jivo Auth people and password (FE-033)', () => {
  it('offers password change only when advertised in Jivo mode', () => {
    expect(identityFromOptions({ identity: 'jivo', password_change: true }).canChangePassword).toBe(true)
    expect(identityFromOptions({ identity: 'jivo', password_change: false }).canChangePassword).toBe(false)
    expect(identityFromOptions({ identity: 'jivo' }).canChangePassword).toBe(false)
    expect(identityFromOptions({ identity: 'local' }).canChangePassword).toBe(true)
    expect(identityFromOptions({ identity: 'local', password_change: false }).canChangePassword).toBe(false)
    expect(identityFromOptions({ identity: 'jivo', name_change: true }).canChangeName).toBe(true)
    expect(identityFromOptions({ identity: 'jivo', name_change: 'yes' as unknown as boolean }).canChangeName).toBe(false)
  })
  it('drops the Invited filter in Jivo mode only', () => {
    expect(peopleStatuses(false)).toEqual(['active', 'invited', 'inactive', 'deleted', 'all'])
    expect(peopleStatuses(true)).toEqual(['active', 'inactive', 'deleted', 'all'])
  })
})

describe('profile mail shortcut', () => {
  it('builds a mailto only for a plain address', () => {
    expect(safeMailHref('tester@example.invalid')).toBe('mailto:tester@example.invalid')
    for (const bad of [null, '', 'no-at', 'a@b', 'a@b.c?bcc=x@y.z', 'a b@c.d', 'javascript:x@y.z']) expect(safeMailHref(bad)).toBeNull()
  })
})
