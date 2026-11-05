import * as LocalAuthentication from 'expo-local-authentication'
import { Platform } from 'react-native'

/** Device verification is an additional gate, never a substitute for server step-up. */
export async function verifyVaultDevice(signal: AbortSignal): Promise<boolean> {
  const check = () => { if (signal.aborted) throw Object.assign(new Error('Verification cancelled.'), { name: 'AbortError' }) }
  check()
  if (Platform.OS === 'web') return true
  let prompting = false
  const cancel = () => { if (prompting && Platform.OS === 'android') void LocalAuthentication.cancelAuthenticate().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    const hardware = await LocalAuthentication.hasHardwareAsync(); check()
    const enrolled = hardware && await LocalAuthentication.isEnrolledAsync(); check()
    if (!enrolled) return false
    prompting = true
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Passwords', cancelLabel: 'Use password', fallbackLabel: 'Use password',
      disableDeviceFallback: true, biometricsSecurityLevel: 'strong',
    })
    check()
    return result.success
  } catch {
    check()
    // Unavailable/locked-out device authentication falls back to server password verification.
    return false
  } finally { prompting = false; signal.removeEventListener('abort', cancel) }
}
