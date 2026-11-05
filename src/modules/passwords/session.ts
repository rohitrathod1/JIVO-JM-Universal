import { StepUpFlow } from '../../core/auth/stepUpFlow'
import { confirmPassword, confirmPasskey, isPasskeyCancel } from '../../core/auth/security'
import { verifyVaultDevice } from '../../core/auth/vaultDeviceVerification'
import { errorMessage } from '../../core/api/client'
import { unlock } from './api'
import { VaultLock } from './lock'

function createGate() {
  const fallback = new StepUpFlow({ supported: () => false, password: confirmPassword, passkey: confirmPasskey, message: errorMessage, cancelled: isPasskeyCancel })
  const lock = new VaultLock({ unlock: async signal => {
    const verified = await verifyVaultDevice(signal)
    if (signal.aborted) throw Object.assign(Error('Verification cancelled.'), { name: 'AbortError' })
    if (!verified && !await fallback.request('jp', ['password'], signal)) throw { response: { data: { code: 'step_up_required' } } }
    if (signal.aborted) throw Object.assign(Error('Verification cancelled.'), { name: 'AbortError' })
    return unlock(signal)
  }, message: errorMessage, cancelled: error => (error as { response?: { data?: { code?: string } } })?.response?.data?.code === 'step_up_required' })
  return { lock, fallback }
}
let cached: { owner: string; gate: ReturnType<typeof createGate> } | null = null
/** Memory only; verification survives navigation, never an authentication boundary. */
export function clearVaultSession() {
  if (!cached) return
  cached.gate.lock.stop()
  cached.gate.lock.lock()
  cached.gate.fallback.clear()
  cached = null
}
export function vaultSession(owner: string) {
  if (cached?.owner !== owner) {
    clearVaultSession()
    cached = { owner, gate: createGate() }
  }
  cached!.gate.lock.check()
  return cached!.gate
}
