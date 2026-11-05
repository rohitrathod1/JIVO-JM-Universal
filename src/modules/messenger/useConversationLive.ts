import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../core/api/client'
import { realtime } from '../../core/realtime/socket'
import { subscribeSensitiveView } from '../../shared/sensitiveLifecycle'
import { listMembers, type ConversationItem, type Member } from './api'
import { lastSeenLabel, typingLabel } from './lib/text'
type Presence = { online: boolean | null; last_seen_at: string | null }
export function useConversationLive(conversation: ConversationItem | null, me: string) {
 const id=conversation?.id; const peer=conversation?.kind==='direct'?conversation.peer?.id:undefined
 const [snapshot,setSnapshot]=useState<{ id:string; members:Member[]; presence:Presence | null; typing:Record<string,number> }>({id:'',members:[],presence:null,typing:{}})
 const [now,setNow]=useState(() => Date.now()); const lastStart=useRef(0); const started=useRef(false); const visible=useRef(true);const idle=useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
 const stop=useCallback(()=>{clearTimeout(idle.current);if(started.current && id)realtime.send('TYPING',{conversation:id,state:'stop'});started.current=false;lastStart.current=0},[id])
 useEffect(()=>{let active=true;let generation=0
  const clear=()=>{generation++;setSnapshot({id:id??'',members:[],presence:null,typing:{}})}
  const load=()=>{if(!id||!visible.current)return;const token=++generation;void Promise.all([listMembers(id),peer?api.get<{results:Record<string,Presence>}>('/users/presence/',{params:{ids:peer}}).then(r=>r.data.results[peer]??null):Promise.resolve(null)]).then(([members,presence])=>{if(active&&generation===token&&visible.current)setSnapshot(old=>({id,members,presence,typing:old.id===id?old.typing:{}}))}).catch(()=>{/* Optional presence never blocks chat. */})}
  const off=realtime.on<{conversation?:string;user?:string;last_seen_at?:string}>('*',({type,data})=>{if(!active||!id||!visible.current)return;if(type==='RESYNC'){clear();load();return}if(type==='MEMBER_REMOVED'||type==='MEMBER_ADDED'||type==='MEMBER_ROLE_CHANGED'){if(data?.conversation===id)load();return}if(!data?.user)return;if((type==='TYPING_STARTED'||type==='TYPING_STOPPED')&&data.conversation===id&&data.user!==me){setNow(Date.now());setSnapshot(old=>old.id===id?{...old,typing:{...old.typing,[data.user!]:type==='TYPING_STARTED'?Date.now()+6000:0}}:old)}if(data.user===peer&&(type==='USER_ONLINE'||type==='USER_OFFLINE'))setSnapshot(old=>old.id===id?{...old,presence:{online:type==='USER_ONLINE',last_seen_at:data.last_seen_at??null}}:old)})
  const lifecycle=subscribeSensitiveView(value=>{visible.current=value;if(!value){stop();clear()}else load()})
  return()=>{active=false;generation++;off();lifecycle();stop()}
 },[id,peer,me,stop])
 // Tick every second only while someone is typing (expiry); otherwise once a minute for the last-seen label.
 // A constant 1 s tick re-rendered the whole messenger (and every chat row) while idle.
 const typingActive=Object.values(snapshot.typing).some(until=>until>now)
 useEffect(()=>{if(!id)return;const timer=setInterval(()=>setNow(Date.now()),typingActive?1000:60000);return()=>clearInterval(timer)},[id,typingActive])
 const current=snapshot.id===id?snapshot:null; const names=Object.entries(current?.typing??{}).filter(([user,until])=>until>now&&current?.members.some(m=>m.user.id===user)).map(([user])=>current!.members.find(m=>m.user.id===user)!.user.name)
 const label=names.length?typingLabel(names,conversation?.kind==='group'):current?.presence?.online?'online':current?.presence?.last_seen_at?lastSeenLabel(current.presence.last_seen_at):''
 return {members:current?.members??[],label,stop,typing:()=>{if(!id||!conversation?.can.send||!visible.current)return;const time=Date.now();if(time-lastStart.current>3000){lastStart.current=time;started.current=realtime.send('TYPING',{conversation:id,state:'start'})||started.current}clearTimeout(idle.current);idle.current=setTimeout(stop,5000)}}
}

