import { browserSupportsWebAuthn, startAuthentication, startRegistration, WebAuthnAbortService } from '@simplewebauthn/browser'
import { api } from '../api/client'
export type { SecondFactor, StepUpScope, StepUpMethod, PasskeyInfo, SecurityStatus, LoginResponse } from './securityTypes'
type AuthenticationOptions = Parameters<typeof startAuthentication>[0]['optionsJSON']
type RegistrationOptions = Parameters<typeof startRegistration>[0]['optionsJSON']
export const passkeysSupported = () => browserSupportsWebAuthn()
export async function signInWithPasskey(token?: string): Promise<void> {
  await api.get('/auth/csrf/')
  const { data } = await api.post<{ flow: string; options: AuthenticationOptions }>('/auth/login/passkey/options/', token ? { mfa_token: token } : {})
  const credential = await startAuthentication({ optionsJSON: data.options })
  await api.post('/auth/login/passkey/', { flow: data.flow, credential, ...(token ? { mfa_token: token } : {}) })
}
export const isPasskeyCancel=(error:unknown)=>['NotAllowedError','AbortError'].includes((error as {name?:string})?.name??'')
export async function confirmPasskey(scope:string,signal?:AbortSignal):Promise<void>{
 const check=()=>{if(signal?.aborted)throw new DOMException('Verification cancelled','AbortError')};check();const cancel=()=>WebAuthnAbortService.cancelCeremony();signal?.addEventListener('abort',cancel,{once:true});
 try{const {data}=await api.post<{methods:string[];passkey:{flow:string;options:AuthenticationOptions}|null}>('/auth/step-up/options/',{scope},{signal});check();if(!data.methods.includes('passkey')||!data.passkey)throw Error('The server did not offer passkey verification.');const credential=await startAuthentication({optionsJSON:data.passkey.options});check();await api.post('/auth/step-up/',{scope,method:'passkey',flow:data.passkey.flow,credential},{signal});check()}finally{signal?.removeEventListener('abort',cancel)}
}
export async function addPasskey(name: string): Promise<{ recovery_codes?: string[] }> {
  const { data } = await api.post<{ flow: string; options: RegistrationOptions }>('/auth/passkeys/options/')
  const credential = await startRegistration({ optionsJSON: data.options })
  return (await api.post<{ recovery_codes?: string[] }>('/auth/passkeys/', { flow: data.flow, credential, name })).data
}
export async function confirmPassword(scope: string, password: string, signal?: AbortSignal) { await api.post('/auth/step-up/', { scope, method: 'password', password }, { signal }) }
