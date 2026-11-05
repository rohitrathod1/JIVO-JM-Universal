import { describe,expect,it,vi } from 'vitest'
import { VaultLock,VAULT_IDLE_MS } from './lock'
const tick=()=>new Promise(resolve=>setTimeout(resolve,0))
function setup(){let now=0;const unlock=vi.fn(async(_signal:AbortSignal)=>({unlocked:true}));const lock=new VaultLock({unlock,now:()=>now,message:()=> 'Unlock failed.',cancelled:e=>(e as {code?:string})?.code==='step_up_required'});return{lock,unlock,advance:(ms:number)=>{now+=ms}}}
describe('automatic vault gate',()=>{
 it('automatically unlocks once per mount without a button click',async()=>{const f=setup();f.lock.start();f.lock.start();await tick();expect(f.unlock).toHaveBeenCalledOnce();expect(f.lock.snapshot().unlocked).toBe(true)})
 it('cancellation stays locked and explicit retry can succeed',async()=>{const f=setup();f.unlock.mockRejectedValueOnce({code:'step_up_required'});f.lock.start();await tick();expect(f.lock.snapshot()).toEqual({unlocked:false,busy:false,error:''});await f.lock.open();expect(f.lock.snapshot().unlocked).toBe(true)})
 it('locks after ten idle minutes and does not auto-reopen',async()=>{const f=setup();f.lock.start();await tick();f.advance(VAULT_IDLE_MS-1);f.lock.check();expect(f.lock.snapshot().unlocked).toBe(true);f.lock.touch();f.advance(VAULT_IDLE_MS);f.lock.check();expect(f.lock.snapshot().unlocked).toBe(false);expect(f.unlock).toHaveBeenCalledOnce()})
 it('abort/unmount suppresses late unlock and remount starts afresh',async()=>{const f=setup();let finish!:(r:{unlocked:boolean})=>void;f.unlock.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));f.lock.start();f.lock.stop();expect(f.unlock.mock.calls[0][0].aborted).toBe(true);finish({unlocked:true});await tick();expect(f.lock.snapshot().unlocked).toBe(false);f.lock.start();await tick();expect(f.lock.snapshot().unlocked).toBe(true)})
 it('does not expose contents when server refuses unlock',async()=>{const f=setup();f.unlock.mockResolvedValueOnce({unlocked:false});f.lock.start();await tick();expect(f.lock.snapshot()).toMatchObject({unlocked:false,error:'Unlock failed.'})})
})

it('reuses verification when returning before ten idle minutes', async () => {
 const f=setup();f.lock.start();await tick();f.lock.stop();f.advance(VAULT_IDLE_MS-1);f.lock.start();await tick();expect(f.lock.snapshot().unlocked).toBe(true);expect(f.unlock).toHaveBeenCalledOnce()
})
it('requires verification when returning after the idle window', async () => {
 const f=setup();f.lock.start();await tick();f.lock.stop();f.advance(VAULT_IDLE_MS);f.unlock.mockRejectedValueOnce({code:'step_up_required'});f.lock.start();await tick();expect(f.lock.snapshot().unlocked).toBe(false);expect(f.unlock).toHaveBeenCalledTimes(2)
})
it('explicit session invalidation discards a retained unlock', async () => {
 const f=setup();f.lock.start();await tick();f.lock.stop();f.lock.lock();f.lock.start();await tick();expect(f.unlock).toHaveBeenCalledTimes(2)
})
