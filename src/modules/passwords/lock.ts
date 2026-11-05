export const VAULT_IDLE_MS=10*60*1000
export class VaultLock{
 private listeners=new Set<()=>void>();private active=false;private epoch=0;private lastActivity=0;private flight:AbortController|null=null;private state={unlocked:false,busy:false,error:''}
 constructor(private deps:{unlock:(signal:AbortSignal)=>Promise<{unlocked:boolean}>;message:(error:unknown)=>string;cancelled:(error:unknown)=>boolean;now?:()=>number}){}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};private set(value:Partial<typeof this.state>){this.state={...this.state,...value};this.listeners.forEach(fn=>fn())};private now=()=>this.deps.now?.()??Date.now()
 start=()=>{if(this.active)return;this.active=true;this.check();void this.open()}
 stop=()=>{this.active=false;this.epoch++;this.flight?.abort();this.flight=null;this.set({busy:false,error:''})}
 lock=()=>{this.epoch++;this.flight?.abort();this.flight=null;this.set({unlocked:false,busy:false,error:''})}
 touch=()=>{if(this.state.unlocked)this.lastActivity=this.now()}
 check=()=>{if(this.state.unlocked&&this.now()-this.lastActivity>=VAULT_IDLE_MS)this.lock()}
 open=async()=>{if(!this.active||this.state.busy||this.state.unlocked)return;const epoch=++this.epoch;const controller=new AbortController();this.flight=controller;this.set({busy:true,error:''});try{const result=await this.deps.unlock(controller.signal);if(epoch!==this.epoch||!this.active||controller.signal.aborted)return;if(!result.unlocked)throw Error('Passwords could not be unlocked.');this.lastActivity=this.now();this.set({unlocked:true})}catch(error){if(epoch===this.epoch&&this.active)this.set({error:this.deps.cancelled(error)?'':this.deps.message(error)})}finally{if(epoch===this.epoch){this.flight=null;this.set({busy:false})}}}
}
