import { useEffect, useState } from 'react'
import { api, origin } from '../api/client'
import { identityFromOptions, type Identity, type SignInOptions } from './identityModel'

export { identityFromOptions, localIdentity, type Identity, type SignInOptions } from './identityModel'

/**
 * Where JM accounts live (FE-032 / BE-082). "local": JM keeps passwords itself. "jivo": the JIVO account in Jivo Auth
 * holds the password, email, name and employee code; JM keeps everything else. The public GET /auth/options/ is read
 * once and shared by every screen (sign-in, invitation, profile, administration) for a minute.
 */
const STALE_MS = 60_000
let cached: { at: number; value: Promise<Identity> } | null = null

export function loadIdentity(force = false): Promise<Identity> {
  if (!origin) return Promise.resolve(identityFromOptions(null))
  if (!force && cached && Date.now() - cached.at < STALE_MS) return cached.value
  const value = api.get<SignInOptions>('/auth/options/').then(r => identityFromOptions(r.data))
  const entry = { at: Date.now(), value }
  cached = entry
  // Never keep a failure: the next screen asks again ("local" is shown meanwhile, as before this setting existed).
  value.catch(() => { if (cached === entry) cached = null })
  return value
}

export function useIdentity(): Identity & { known: boolean } {
  const [state, setState] = useState<{ identity: Identity; known: boolean }>({ identity: identityFromOptions(null), known: false })
  useEffect(() => {
    let active = true
    loadIdentity().then(identity => { if (active) setState({ identity, known: true }) }).catch(() => { if (active) setState(s => ({ ...s, known: true })) })
    return () => { active = false }
  }, [])
  return { ...state.identity, known: state.known }
}
