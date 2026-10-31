import {describe,it,expect,vi} from 'vitest'
import {AppLockModel} from './appLockModel'
import {AppLockAttempt} from './appLockAttempt'
const deferred=<T,>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve}}
function setup(){const model=new AppLockModel({read:()=>true,write:()=>{}});const deps={model,foreground:()=>true,status:vi.fn(async()=>({mfa_enrolled:true,passkeys:[{}] as unknown[]})),options:vi.fn(async()=>({methods:['passkey']})),request:vi.fn(async()=>true),clear:vi.fn(),message:()=> 'Verification failed'};return{model,deps,attempt:new AppLockAttempt(deps)}}
describe('whole app-lock attempt',()=>{
 it('cancelled delayed status never requests options or credentials',async()=>{const x=setup(),d=deferred<{mfa_enrolled:boolean;passkeys:unknown[]}>();x.deps.status.mockReturnValue(d.promise);const p=x.attempt.start();x.attempt.cancel();d.resolve({mfa_enrolled:true,passkeys:[{}]});await p;expect(x.deps.options).not.toHaveBeenCalled();expect(x.deps.request).not.toHaveBeenCalled();expect(x.model.snapshot().locked).toBe(true)})
 it('cancelled delayed options never opens credentials',async()=>{const x=setup(),d=deferred<{methods:string[]}>();x.deps.options.mockReturnValue(d.promise);const p=x.attempt.start();await Promise.resolve();x.attempt.cancel();d.resolve({methods:['passkey']});await p;expect(x.deps.request).not.toHaveBeenCalled()})
 it('late success after background cannot unlock, even if dependency ignores abort',async()=>{const x=setup(),d=deferred<boolean>();x.deps.request.mockReturnValue(d.promise);const p=x.attempt.start();await Promise.resolve();await Promise.resolve();x.model.visibility(false);x.attempt.cancel();x.model.visibility(true);d.resolve(true);await p;expect(x.model.snapshot().locked).toBe(true);expect(x.deps.clear).toHaveBeenCalled()})
 it('model relock invalidates successful old verification without relying on abort',async()=>{const x=setup(),d=deferred<boolean>();x.deps.request.mockReturnValue(d.promise);const p=x.attempt.start();await Promise.resolve();await Promise.resolve();x.model.visibility(false);x.model.visibility(true);d.resolve(true);await p;expect(x.model.snapshot().locked).toBe(true)})
 it('fresh foreground attempt unlocks',async()=>{const x=setup();await x.attempt.start();expect(x.model.snapshot().locked).toBe(false)})
 it('background attempt opens no network or credential surface',async()=>{const x=setup();x.deps.foreground=()=>false;await x.attempt.start();expect(x.deps.status).not.toHaveBeenCalled()})
})
