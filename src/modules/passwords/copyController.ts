export class SecretCopyController {
 private active=true;private generation=0;private pending=false;private listeners=new Set<()=>void>();private state={busy:false,notice:''};
 constructor(private deps:{write:(value:string)=>Promise<void>;report:()=>Promise<unknown>}){}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};private set(busy:boolean,notice=''){this.state={busy,notice};this.listeners.forEach(fn=>fn())}
 setActive=(active:boolean)=>{this.active=active;if(!active){this.generation++;this.set(false)}}
 async copy(value:string){if(!this.active||this.pending)return;this.pending=true;const generation=++this.generation;this.set(true);try{await this.deps.write(value);if(!this.active||generation!==this.generation)return;try{await this.deps.report()}catch{if(this.active&&generation===this.generation)this.set(false,'Copied, but the copy audit could not be confirmed. Clipboard is not automatically cleared.');return}if(this.active&&generation===this.generation)this.set(false,'Copied. Clipboard is not automatically cleared; replace it after use.')}catch{if(this.active&&generation===this.generation)this.set(false,'Could not copy. The clipboard may be unavailable or permission was denied.')}finally{this.pending=false}}
}
