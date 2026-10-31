import {describe,it,expect} from 'vitest'
import {AppLockModel} from './appLockModel'
function setup(on=false){let enabled=on,now=0;const model=new AppLockModel({read:()=>enabled,write:value=>{enabled=value}},()=>now);return{model,advance:(n:number)=>now+=n,external:(v:boolean)=>{enabled=v}}}
describe('device app lock',()=>{
 it('starts locked only for an enabled account and unlock is memory only',()=>{const x=setup(true);expect(x.model.snapshot().locked).toBe(true);x.model.unlock(x.model.token());expect(x.model.snapshot()).toEqual({enabled:true,locked:false})})
 it('enables only after caller verification and can disable',()=>{const x=setup();x.model.enable();expect(x.model.snapshot()).toEqual({enabled:true,locked:false});x.model.disable();expect(x.model.snapshot().enabled).toBe(false)})
 it('locks after five minutes in background, including duplicate hidden events',()=>{const x=setup(true);x.model.unlock(x.model.token());x.model.visibility(false);x.advance(299999);x.model.visibility(false);x.advance(1);x.model.visibility(true);expect(x.model.snapshot().locked).toBe(true)})
 it('short background remains open and a subsequent interval starts fresh',()=>{const x=setup(true);x.model.unlock(x.model.token());x.model.visibility(false);x.advance(200000);x.model.visibility(true);expect(x.model.snapshot().locked).toBe(false);x.model.visibility(false);x.advance(100000);x.model.visibility(true);expect(x.model.snapshot().locked).toBe(false)})
 it('another tab enabling locks this tab; disabling clears lock',()=>{const x=setup();x.external(true);x.model.sync();expect(x.model.snapshot().locked).toBe(true);x.external(false);x.model.sync();expect(x.model.snapshot().locked).toBe(false)})
 it('failed persistence never advertises enabled',()=>{const model=new AppLockModel({read:()=>false,write:()=>{throw Error('blocked')}});expect(()=>model.enable()).toThrow('blocked');expect(model.snapshot().enabled).toBe(false)})
})

describe('storage failure and lock generations',()=>{
 it('unknown initial storage fails closed',()=>{const m=new AppLockModel({read:()=>{throw Error('denied')},write:()=>{}});expect(m.snapshot()).toMatchObject({enabled:true,locked:true});expect(m.snapshot().error).toContain('unavailable')})
 it('read failure during sync locks rather than disabling',()=>{let fail=false;const m=new AppLockModel({read:()=>{if(fail)throw Error('denied');return true},write:()=>{}});m.unlock(m.token());fail=true;m.sync();expect(m.snapshot()).toMatchObject({enabled:true,locked:true});expect(m.snapshot().error).toBeTruthy()})
 it('late verification cannot unlock after background and relock',()=>{let now=0;const m=new AppLockModel({read:()=>true,write:()=>{}},()=>now);const token=m.token();m.visibility(false);now=300001;m.visibility(true);m.unlock(token);expect(m.snapshot().locked).toBe(true)})
})
