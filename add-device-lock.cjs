const fs=require('fs');
fs.writeFileSync('src/core/auth/appLockModel.ts',`export interface AppLockState { enabled:boolean; locked:boolean }
export class AppLockModel {
 private state:AppLockState;private hiddenAt:number|null=null;private listeners=new Set<()=>void>();
 constructor(private storage:{read:()=>boolean;write:(on:boolean)=>void},private now=()=>Date.now()){const enabled=storage.read();this.state={enabled,locked:enabled}}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};
 private set(state:AppLockState){this.state=state;this.listeners.forEach(fn=>fn())}
 enable=()=>{this.storage.write(true);this.set({enabled:true,locked:false})};disable=()=>{this.storage.write(false);this.set({enabled:false,locked:false})};unlock=()=>this.set({...this.state,locked:false});
 sync=()=>{const enabled=this.storage.read();if(enabled!==this.state.enabled)this.set({enabled,locked:enabled})};
 visibility=(visible:boolean)=>{if(!visible){if(this.hiddenAt===null)this.hiddenAt=this.now();return}if(this.hiddenAt!==null&&this.now()-this.hiddenAt>=300000&&this.state.enabled)this.set({...this.state,locked:true});this.hiddenAt=null}
}
`);
fs.writeFileSync('src/core/auth/appLockModel.test.ts',`import {describe,it,expect} from 'vitest'
import {AppLockModel} from './appLockModel'
function setup(on=false){let enabled=on,now=0;const model=new AppLockModel({read:()=>enabled,write:value=>{enabled=value}},()=>now);return{model,advance:(n:number)=>now+=n,external:(v:boolean)=>{enabled=v}}}
describe('device app lock',()=>{
 it('starts locked only for an enabled account and unlock is memory only',()=>{const x=setup(true);expect(x.model.snapshot().locked).toBe(true);x.model.unlock();expect(x.model.snapshot()).toEqual({enabled:true,locked:false})})
 it('enables only after caller verification and can disable',()=>{const x=setup();x.model.enable();expect(x.model.snapshot()).toEqual({enabled:true,locked:false});x.model.disable();expect(x.model.snapshot().enabled).toBe(false)})
 it('locks after five minutes in background, including duplicate hidden events',()=>{const x=setup(true);x.model.unlock();x.model.visibility(false);x.advance(299999);x.model.visibility(false);x.advance(1);x.model.visibility(true);expect(x.model.snapshot().locked).toBe(true)})
 it('short background remains open and a subsequent interval starts fresh',()=>{const x=setup(true);x.model.unlock();x.model.visibility(false);x.advance(200000);x.model.visibility(true);expect(x.model.snapshot().locked).toBe(false);x.model.visibility(false);x.advance(100000);x.model.visibility(true);expect(x.model.snapshot().locked).toBe(false)})
 it('another tab enabling locks this tab; disabling clears lock',()=>{const x=setup();x.external(true);x.model.sync();expect(x.model.snapshot().locked).toBe(true);x.external(false);x.model.sync();expect(x.model.snapshot().locked).toBe(false)})
 it('failed persistence never advertises enabled',()=>{const model=new AppLockModel({read:()=>false,write:()=>{throw Error('blocked')}});expect(()=>model.enable()).toThrow('blocked');expect(model.snapshot().enabled).toBe(false)})
})
`);
fs.writeFileSync('src/components/AppLock.tsx',`import type {ReactNode} from 'react'
import {Card,Label} from '../ui'
export function AppLock({children}:{children:ReactNode}){return <>{children}</>}
export function AppLockSetting(){return <Card><Label>Device passkey app lock is unavailable on native until passkey integration is validated.</Label></Card>}
`);
fs.writeFileSync('src/components/AppLock.web.tsx',`import {createContext,useContext,useEffect,useState,useSyncExternalStore,type ReactNode} from 'react'
import {View,Text} from 'react-native'
import {useSession} from '../core/auth/Session'
import {api,errorMessage} from '../core/api/client'
import {confirmPasskey,confirmPassword,passkeysSupported,isPasskeyCancel} from '../core/auth/security'
import {StepUpFlow} from '../core/auth/stepUpFlow'
import {AppLockModel} from '../core/auth/appLockModel'
import {Button,Card,Field,Label,styles} from '../ui'
const Context=createContext<AppLockModel|null>(null)
export function AppLock({children}:{children:ReactNode}){const {me,status}=useSession();return status==='ready'&&me?<AccountLock key={me.id+':'+(me.session?.id??'none')} userId={me.id}>{children}</AccountLock>:<>{children}</>}
function AccountLock({userId,children}:{userId:string;children:ReactNode}){
 const [model]=useState(()=>new AppLockModel({read:()=>{try{return localStorage.getItem('jm.applock.'+userId)==='1'}catch{return false}},write:on=>{if(on)localStorage.setItem('jm.applock.'+userId,'1');else localStorage.removeItem('jm.applock.'+userId)}}));const state=useSyncExternalStore(model.subscribe,model.snapshot,model.snapshot)
 useEffect(()=>{const visibility=()=>model.visibility(document.visibilityState==='visible');const sync=(e:StorageEvent)=>{if(e.key===null||e.key==='jm.applock.'+userId)model.sync()};document.addEventListener('visibilitychange',visibility);window.addEventListener('storage',sync);return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('storage',sync)}},[model,userId])
 return <Context.Provider value={model}>{state.enabled&&state.locked?<LockScreen model={model}/>:children}</Context.Provider>
}
function LockScreen({model}:{model:AppLockModel}){
 const {logout}=useSession();const [flow]=useState(()=>new StepUpFlow({supported:passkeysSupported,password:confirmPassword,passkey:confirmPasskey,message:errorMessage,cancelled:isPasskeyCancel}));const state=useSyncExternalStore(flow.subscribe,flow.snapshot,flow.snapshot);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0)
 useEffect(()=>{const controller=new AbortController();let active=true;void (async()=>{try{const {data:security}=await api.get<{mfa_enrolled:boolean;passkeys:unknown[]}>('/auth/mfa/',{signal:controller.signal});if(!active)return;if(!security.mfa_enrolled||!security.passkeys.length){model.disable();return}const {data}=await api.post<{methods:string[]}>('/auth/step-up/options/',{scope:'app_unlock'},{signal:controller.signal});if(!active)return;if(await flow.request('app_unlock',data.methods,controller.signal)){if(active)model.unlock()}}catch(e){if(active)setError(errorMessage(e))}})();return()=>{active=false;controller.abort();flow.clear()}},[model,flow,attempt])
 return <View style={styles.page}><Card><Label large>JM is locked</Label><Label>Confirm with your fingerprint, face or PIN.</Label>{!!(error||state.error)&&<Text accessibilityRole="alert">{error||state.error}</Text>}{state.method==='password'&&<><Field label="App unlock password" secureTextEntry value={state.secret} onChangeText={flow.setSecret}/><Button title="Unlock JM" disabled={state.busy||!state.secret} onPress={()=>void flow.verify('password')}/></>}{state.methods.includes('passkey')&&<Button title="Unlock JM with passkey" disabled={state.busy} onPress={()=>void flow.verify('passkey')}/>}{state.method==='passkey'&&state.methods.includes('password')&&<Button title="Use your password instead" onPress={flow.usePassword}/>}<Button title="Cancel app verification" onPress={flow.cancel}/>{!state.active&&<Button title="Retry app unlock" onPress={()=>{setError('');setAttempt(x=>x+1)}}}<Button title="Sign out of locked JM" onPress={()=>void logout()}/></Card></View>
}
export function AppLockSetting(){const model=useContext(Context);return model?<Setting model={model}/>:null}
function Setting({model}:{model:AppLockModel}){
 const {me}=useSession();const state=useSyncExternalStore(model.subscribe,model.snapshot,model.snapshot);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [lifetime]=useState(()=>({active:true,flight:null as AbortController|null}));useEffect(()=>{lifetime.active=true;return()=>{lifetime.active=false;lifetime.flight?.abort()}},[lifetime]);const ready=!!me?.security.mfa_enrolled&&!!me.security.passkeys.length&&passkeysSupported();
 async function enable(){if(busy)return;const controller=new AbortController();lifetime.flight=controller;setBusy(true);setError('');try{await confirmPasskey('app_unlock',controller.signal);if(lifetime.active&&!controller.signal.aborted)model.enable()}catch(e){if(lifetime.active&&!isPasskeyCancel(e))setError(errorMessage(e))}finally{if(lifetime.active)setBusy(false);lifetime.flight=null}}
 return <Card><Label large>Lock JM with your passkey</Label><Label>{state.enabled?'On: verify when opening JM or after five minutes in the background.':'Turn on two-step verification and add a passkey first. This is a device privacy screen; server permissions remain authoritative.'}</Label>{!!error&&<Text accessibilityRole="alert">{error}</Text>}{state.enabled?<Button title="Turn off app lock" onPress={()=>{try{model.disable()}catch(e){setError(errorMessage(e))}}}/>:<Button title="Turn on app lock" disabled={!ready||busy} onPress={()=>void enable()}/>}</Card>
}
`);
let s=fs.readFileSync('src/app/_layout.tsx','utf8');s="import { AppLock } from '../components/AppLock'\n"+s;s=s.replace('<Stack screenOptions={{ headerShown: false }} /><StepUp />','<AppLock><Stack screenOptions={{ headerShown: false }} /><StepUp /></AppLock>');fs.writeFileSync('src/app/_layout.tsx',s);
s=fs.readFileSync('src/components/ProfilePanel.tsx','utf8');s="import { AppLockSetting } from './AppLock'\n"+s;s=s.replace('<InstallApp />','<InstallApp /><AppLockSetting />');fs.writeFileSync('src/components/ProfilePanel.tsx',s);
s=fs.readFileSync('src/core/auth/securityTypes.ts','utf8').replace("'admin' | 'jp'","'admin' | 'jp' | 'app_unlock'");fs.writeFileSync('src/core/auth/securityTypes.ts',s);
