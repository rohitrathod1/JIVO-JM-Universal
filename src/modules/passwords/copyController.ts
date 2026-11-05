export const CLIPBOARD_CLEAR_MS = 30_000
type CopyDeps = { write: (value: string) => Promise<void>; report: () => Promise<unknown>; clear?: (value: string) => Promise<void>; clearAfterMs?: number; schedule?: (fn: () => void, ms: number) => unknown; cancel?: (handle: unknown) => void }
export class SecretCopyController {
 private active=true;private generation=0;private pending=false;private listeners=new Set<()=>void>();private state={busy:false,notice:''};private timer:unknown=null
 constructor(private deps:CopyDeps){}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};private set(busy:boolean,notice=''){this.state={busy,notice};this.listeners.forEach(fn=>fn())}
 setActive=(active:boolean)=>{this.active=active;if(!active){this.generation++;this.set(false)}}
 // The clear timer deliberately outlives blur/unmount: the copied secret stays on the
 // clipboard after the view hides, so it must still be wiped. A newer copy replaces it.
 private scheduleClear(value:string){const {clear}=this.deps;if(!clear)return;const schedule=this.deps.schedule??((fn,ms)=>setTimeout(fn,ms)),cancel=this.deps.cancel??(h=>clearTimeout(h as ReturnType<typeof setTimeout>));if(this.timer!==null)cancel(this.timer);const handle=schedule(()=>{if(this.timer===handle)this.timer=null;void clear(value).catch(()=>{})},this.deps.clearAfterMs??CLIPBOARD_CLEAR_MS);this.timer=handle}
 private copied(){return this.deps.clear?'Copied. The clipboard is cleared after 30 seconds if it still holds this value.':'Copied. Clipboard is not automatically cleared; replace it after use.'}
 async copy(value:string){if(!this.active||this.pending)return;this.pending=true;const generation=++this.generation;this.set(true);try{await this.deps.write(value);this.scheduleClear(value);if(!this.active||generation!==this.generation)return;try{await this.deps.report()}catch{if(this.active&&generation===this.generation)this.set(false,`Copied, but the copy audit could not be confirmed. ${this.deps.clear?'The clipboard is cleared after 30 seconds.':'Clipboard is not automatically cleared.'}`);return}if(this.active&&generation===this.generation)this.set(false,this.copied())}catch{if(this.active&&generation===this.generation)this.set(false,'Could not copy. The clipboard may be unavailable or permission was denied.')}finally{this.pending=false}}
}
