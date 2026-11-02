import { describe, expect, it } from 'vitest'
import { canSubmitToken, identityFromOptions, localIdentity, safeWebUrl, tokenPageMode } from './identityModel'
import { addableJivoCandidates, type JivoCandidate } from '../../modules/admin/jivoCandidates'
import { safeMailHref } from '../../modules/profile/contact'

describe('identity from /auth/options/', () => {
  it('stays local when the server says nothing new', () => {
    expect(identityFromOptions(null)).toEqual(localIdentity)
    expect(identityFromOptions({ passkey_sign_in: true })).toEqual({ jivo: false, passwordResetUrl: null, passkeySignIn: true })
    expect(identityFromOptions({ passkey_sign_in: false, identity: 'local', password_reset_url: 'https://auth.example.invalid/forgot-password/' }).passwordResetUrl).toBeNull()
  })
  it('reads Jivo Auth and keeps only a web reset address', () => {
    expect(identityFromOptions({ passkey_sign_in: false, identity: 'jivo', password_reset_url: 'https://auth.example.invalid/forgot-password/' }))
      .toEqual({ jivo: true, passwordResetUrl: 'https://auth.example.invalid/forgot-password/', passkeySignIn: false })
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

describe('New person with Jivo Auth', () => {
  const person = (over: Partial<JivoCandidate>): JivoCandidate => ({ auth_id: 'a1', email: 'asha@example.invalid', full_name: 'Asha Rao', employee_code: 'E-17', is_active: true, local_user_id: null, ...over })
  const list = [person({}), person({ auth_id: 'a2', full_name: 'Bina Shah', email: 'bina@example.invalid', employee_code: 'E-22', local_user_id: 'u2' }), person({ auth_id: 'a3', full_name: 'Chetan Das', email: 'chetan@example.invalid', employee_code: '', is_active: false }), person({ auth_id: 'a4', full_name: 'Dev Patel', email: 'dev@example.invalid', employee_code: 'E-40' })]
  it('shows only active JIVO accounts not yet in JM', () => {
    expect(addableJivoCandidates(list, '').map(p => p.auth_id)).toEqual(['a1', 'a4'])
    expect(addableJivoCandidates(null, '')).toEqual([])
  })
  it('searches name, email and employee code', () => {
    expect(addableJivoCandidates(list, ' DEV ').map(p => p.auth_id)).toEqual(['a4'])
    expect(addableJivoCandidates(list, 'e-17').map(p => p.auth_id)).toEqual(['a1'])
    expect(addableJivoCandidates(list, 'bina')).toEqual([])
  })
})

describe('profile mail shortcut', () => {
  it('builds a mailto only for a plain address', () => {
    expect(safeMailHref('tester@example.invalid')).toBe('mailto:tester@example.invalid')
    for (const bad of [null, '', 'no-at', 'a@b', 'a@b.c?bcc=x@y.z', 'a b@c.d', 'javascript:x@y.z']) expect(safeMailHref(bad)).toBeNull()
  })
})
