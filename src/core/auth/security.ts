import { api } from '../api/client'
export type { SecondFactor, StepUpScope, StepUpMethod, PasskeyInfo, SecurityStatus, LoginResponse } from './securityTypes'
export const passkeysSupported = () => false
export async function signInWithPasskey(_token?: string): Promise<void> {
  throw new Error('Native passkeys require platform association and credential-provider integration. Use a server-offered alternative; verification is never bypassed.')
}
export async function confirmPasskey(_scope: string, _signal?: AbortSignal): Promise<void> { throw new Error('Native passkey verification is not configured.') }
export async function addPasskey(_name: string): Promise<{ recovery_codes?: string[] }> { throw new Error('Native passkey enrollment is not configured.') }
export async function confirmPassword(scope: string, password: string, signal?: AbortSignal) { await api.post('/auth/step-up/', { scope, method: 'password', password }, { signal }) }

export const isPasskeyCancel=(error:unknown)=>['NotAllowedError','AbortError'].includes((error as {name?:string})?.name??'')
