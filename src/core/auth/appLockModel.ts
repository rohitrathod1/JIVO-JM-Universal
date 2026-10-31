export interface AppLockState { enabled:boolean; locked:boolean; error?:string }
const unavailable='Device lock preference is unavailable. JM stays locked; restore browser storage access and retry, verify again, or sign out.'
export class AppLockModel {
 private state:AppLockState;private hiddenAt:number|null=null;private epoch=0;private foreground=true;private listeners=new Set<()=>void>();
 constructor(private storage:{read:()=>boolean;write:(on:boolean)=>void},private now=()=>Date.now()){try{const enabled=storage.read();this.state={enabled,locked:enabled}}catch{this.state={enabled:true,locked:true,error:unavailable}}}
 snapshot=()=>this.state;token=()=>this.epoch;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};
 private set(state:AppLockState){this.state=state;this.listeners.forEach(fn=>fn())}
 enable=()=>{this.storage.write(true);this.epoch++;this.set({enabled:true,locked:false})};disable=()=>{this.storage.write(false);this.epoch++;this.set({enabled:false,locked:false})};unlock=(token:number)=>{if(token===this.epoch&&this.foreground)this.set({...this.state,locked:false})};
 sync=()=>{try{const enabled=this.storage.read();if(enabled!==this.state.enabled||this.state.error){this.epoch++;this.set({enabled,locked:enabled})}}catch{this.epoch++;this.set({enabled:true,locked:true,error:unavailable})}};
 visibility=(visible:boolean)=>{this.foreground=visible;if(!visible){this.epoch++;if(this.hiddenAt===null)this.hiddenAt=this.now();return}if(this.hiddenAt!==null&&this.now()-this.hiddenAt>=300000&&this.state.enabled){this.epoch++;this.set({...this.state,locked:true})}this.hiddenAt=null}
}
