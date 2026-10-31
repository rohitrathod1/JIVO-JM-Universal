import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSession } from '../core/auth/Session'
import { realtime } from '../core/realtime/socket'
import { getAppearance, type Appearance } from '../modules/messenger/api'
const Context=createContext<{value:Appearance|null;refresh:()=>void}>({value:null,refresh:()=>{}})
export const useChatAppearance=()=>useContext(Context)
export function ChatAppearance({children}:{children:ReactNode}){
 const {me,status}=useSession();const owner=status==='ready'&&me?.capabilities.includes('JM_ACCESS')?me.id:null;const [snapshot,setSnapshot]=useState<{owner:string;value:Appearance}|null>(null);const [revision,setRevision]=useState(0);const refresh=useCallback(()=>setRevision(v=>v+1),[])
 useEffect(()=>{if(!owner)return;let active=true;void getAppearance().then(value=>{if(active)setSnapshot({owner,value})}).catch(()=>{});const off=realtime.on<Appearance>('APPEARANCE_UPDATED',({data})=>{if(active)setSnapshot({owner,value:data})});const reconnect=realtime.on('RESYNC',refresh);return()=>{active=false;off();reconnect()}},[owner,revision,refresh])
 return <Context.Provider value={{value:owner&&snapshot?.owner===owner?snapshot.value:null,refresh}}>{children}</Context.Provider>
}
