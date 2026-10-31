import { useEffect,useState,useSyncExternalStore,type ReactNode } from 'react'
import { View } from 'react-native'
import { useSession } from '../core/auth/Session'
import { errorMessage } from '../core/api/client'
import { unlock } from '../modules/passwords/api'
import { VaultLock } from '../modules/passwords/lock'
import { watchVaultActivity } from '../modules/passwords/activity'
import { Button,Card,Label } from '../ui'
function Gate({children}:{children:ReactNode}){const [lock]=useState(()=>new VaultLock({unlock,message:errorMessage,cancelled:error=>(error as {response?:{data?:{code?:string}}})?.response?.data?.code==='step_up_required'}));const state=useSyncExternalStore(lock.subscribe,lock.snapshot,lock.snapshot);useEffect(()=>{lock.start();const off=watchVaultActivity(lock.touch,lock.check);return()=>{off();lock.stop()}},[lock]);return state.unlocked?<View style={{flex:1}} onTouchStart={lock.touch}><Button title="Lock passwords" onPress={lock.lock}/>{children}</View>:<Card><Label large>Passwords is locked</Label><Label>Confirm it&apos;s you to open it. It locks again after 10 minutes without activity.</Label>{!!state.error&&<Label>{state.error}</Label>}<Button title="Unlock" disabled={state.busy} onPress={()=>void lock.open()}/></Card>}
export function VaultGate({children}:{children:ReactNode}){const {me}=useSession();const allowed=me?.capabilities.some(c=>['JP_ACCESS','JP_MANAGE_VAULT','JP_BREAK_GLASS','JP_REQUEST_EMERGENCY'].includes(c));return allowed?<Gate key={me!.id+':'+(me!.session?.id??'none')}>{children}</Gate>:<Label>Passwords access is not enabled for your account.</Label>}
