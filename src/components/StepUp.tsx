import { PasswordField } from './PasswordField'
import { useEffect,useState,useSyncExternalStore } from 'react'
import { Text } from 'react-native'
import { Sheet } from './Sheet'
import { useSession } from '../core/auth/Session'
import { errorMessage,onStepUpRequired } from '../core/api/client'
import { confirmPasskey,confirmPassword,passkeysSupported,isPasskeyCancel } from '../core/auth/security'
import { StepUpFlow } from '../core/auth/stepUpFlow'
import { Button,Label,useColors } from '../ui'
export function StepUp(){const {me}=useSession();const [flow]=useState(()=>new StepUpFlow({supported:passkeysSupported,password:confirmPassword,passkey:confirmPasskey,message:errorMessage,cancelled:isPasskeyCancel}))
 useEffect(()=>{if(!me?.id)return;onStepUpRequired(flow.request);return()=>{onStepUpRequired(null);flow.clear()}},[flow,me?.id,me?.session?.id])
 return <StepUpPrompt flow={flow}/>
}
export function StepUpPrompt({flow}:{flow:StepUpFlow}){
 const c=useColors();const state=useSyncExternalStore(flow.subscribe,flow.snapshot,flow.snapshot)
 return <Sheet bottomAligned visible={state.active} onClose={flow.cancel}><Label large>Confirm it&apos;s you</Label><Label>{state.scope==='jp'?'You are opening Passwords.':state.scope==='admin'?'This is an administrator action.':'This action changes your security settings.'}</Label>{state.method==='passkey'&&state.busy&&<Label>Confirm with your fingerprint, face or PIN.</Label>}{state.method==='password'&&<><PasswordField label="Current password" autoComplete="current-password" textContentType="password" returnKeyType="go" editable={!state.busy} onSubmitEditing={() => { if (!state.busy && state.secret) void flow.verify('password') }}  value={state.secret} onChangeText={flow.setSecret}/><Button title="Verify password" disabled={state.busy||!state.secret} onPress={()=>void flow.verify('password')}/></>}{state.methods.includes('passkey')&&!(state.method==='passkey'&&state.busy)&&<Button title="Verify with passkey" disabled={state.busy} onPress={()=>void flow.verify('passkey')}/>}{state.method==='passkey'&&state.methods.includes('password')&&<Button title="Use your password instead" onPress={flow.usePassword}/>}{!state.methods.length&&<Label>No supported verification method is available on this platform. Native passkeys still require integration.</Label>}{!!state.error&&<Text accessibilityRole="alert" style={{color:c.text}}>{state.error}</Text>}<Button title="Cancel" onPress={flow.cancel}/></Sheet>
}
