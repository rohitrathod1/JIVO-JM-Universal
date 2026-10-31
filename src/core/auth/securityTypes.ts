export type SecondFactor = 'passkey' | 'recovery_code'
export type StepUpScope = 'security_settings' | 'admin' | 'jp' | 'app_unlock'
export type StepUpMethod = 'passkey' | 'password'

export interface PasskeyInfo {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  synced: boolean
}

export interface SecurityStatus {
  mfa_enrolled: boolean
  mfa_required: boolean
  /** Organisation-wide switch (Admin → Security). */
  two_step_enforced: boolean
  session_verified: boolean
  passkeys: PasskeyInfo[]
  recovery_codes_left: number
  locked_capabilities: string[]
  locked_out: boolean
  /** After administrators recovered this account: Passwords and administration paused until then, and until a
   * passkey sign-in. */
  recovery_hold_until?: string | null
}

export type LoginResponse = { status: 'ok' } | { status: 'mfa_required'; mfa_token: string; methods: SecondFactor[] }


