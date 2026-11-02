/** Public answer of GET /auth/options/ (BE-082): passkey sign-in, and where accounts live. */
export interface SignInOptions {
  passkey_sign_in?: boolean
  identity?: 'local' | 'jivo'
  password_reset_url?: string | null
}

export interface Identity {
  /** True when passwords, emails, names and employee codes live in the JIVO account (Jivo Auth). */
  jivo: boolean
  /** Jivo Auth's own "forgot password" page; only an https (or http) address is ever opened. */
  passwordResetUrl: string | null
  passkeySignIn: boolean
}

export const localIdentity: Identity = { jivo: false, passwordResetUrl: null, passkeySignIn: false }

/** Accept only a plain web address for an external link (never javascript:, data:, intent: or other schemes). */
export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^https?:\/\/[^\s/?#]+/i.test(trimmed) || /[\s<>"]/.test(trimmed)) return null
  return trimmed
}

export function identityFromOptions(data: SignInOptions | null | undefined): Identity {
  if (!data || typeof data !== 'object') return localIdentity
  const jivo = data.identity === 'jivo'
  return { jivo, passwordResetUrl: jivo ? safeWebUrl(data.password_reset_url) : null, passkeySignIn: data.passkey_sign_in === true }
}

/** Invitation / reset token check (GET /auth/invitations/accept/ or /auth/password/reset/). */
export interface TokenCheck {
  valid: boolean
  email?: string
  full_name?: string
  /** "jivo": the invited person signs in with their JIVO password instead of choosing one. */
  identity?: 'local' | 'jivo'
  code?: string
}

export type TokenPurpose = 'invite' | 'reset'

/** What the invitation / reset page shows for a token check (FE-032). */
export function tokenPageMode(check: TokenCheck | null): 'loading' | 'set-password' | 'jivo-sign-in' | 'managed-by-jivo' | 'invalid' {
  if (!check) return 'loading'
  if (!check.valid) return check.code === 'managed_by_jivo_auth' ? 'managed-by-jivo' : 'invalid'
  return check.identity === 'jivo' ? 'jivo-sign-in' : 'set-password'
}

/** Whether the token form may be submitted: one JIVO password, or a new password typed twice. */
export function canSubmitToken(mode: ReturnType<typeof tokenPageMode>, password: string, confirm: string) {
  if (mode === 'jivo-sign-in') return password.length > 0
  return mode === 'set-password' && password.length > 0 && password === confirm
}
