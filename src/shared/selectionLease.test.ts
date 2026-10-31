import { describe,expect,it,vi } from 'vitest'
import { SelectionLease } from './selectionLease'
const asset=()=>({name:'synthetic.png',mime:'image/png',uri:'mock://owned',size:1,dispose:vi.fn()})
describe('owned picker selection',()=>{
 it('disposes a late result after lifecycle invalidation',()=>{const lease=new SelectionLease(vi.fn());const token=lease.begin();lease.invalidate();const file=asset();expect(lease.accept(token,file)).toBe(false);expect(file.dispose).toHaveBeenCalledOnce()})
 it('disposes an older picker result when a newer selection started',()=>{const lease=new SelectionLease(vi.fn());const old=lease.begin();const next=lease.begin();const first=asset(),second=asset();expect(lease.accept(next,second)).toBe(true);expect(lease.accept(old,first)).toBe(false);expect(first.dispose).toHaveBeenCalledOnce();expect(second.dispose).not.toHaveBeenCalled()})
 it('disposes replacement and completion/cancel exactly once',()=>{const lease=new SelectionLease(vi.fn());const first=asset(),second=asset();lease.accept(lease.begin(),first);lease.accept(lease.begin(),second);expect(first.dispose).toHaveBeenCalledOnce();lease.invalidate();lease.invalidate();expect(second.dispose).toHaveBeenCalledOnce()})
 it('reports cleanup errors instead of silently claiming removal',async()=>{const failure=vi.fn();const lease=new SelectionLease(failure);lease.accept(lease.begin(),{...asset(),dispose:()=>{throw Error('cleanup denied')}});lease.invalidate();expect(failure).toHaveBeenCalledOnce()})
})
