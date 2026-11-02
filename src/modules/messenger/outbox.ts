import { deliverOwned } from './ownedDelivery'
import { isAxiosError,isCancel } from 'axios'
import { api,errorMessage } from '../../core/api/client'
import { sessionLost } from '../../core/api/events'
import { withSessionLock } from '../../core/auth/sessionCoordination'
import { sendMessage,type Message } from './api'
import { OutboxController } from './outboxController'
import { outboxStorage } from './outboxStorage'
const listeners=new Set<(message:Message)=>void>()
export const onOutboxSent=(listener:(message:Message)=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
export const outbox:OutboxController=new OutboxController({storage:outboxStorage,send:async(conversation,payload,signal)=>{const local=outbox.snapshot().entries.find(p=>p.conversation===conversation&&p.payload.client_id===payload.client_id);if(!local)return null;return deliverOwned(local.owner,signal,{lock:withSessionLock,exists:async()=> (await outboxStorage.read()).some(p=>p.owner===local.owner&&p.payload.client_id===payload.client_id),identity:async()=> (await api.get<{id:string}>('/me/',{signal})).data.id,send:()=>sendMessage(conversation,payload,signal,local.owner),remove:()=>outboxStorage.remove(local.owner,payload.client_id),mismatch:()=>{outbox.setActive(false);sessionLost()}})},network:e=>isAxiosError(e)&&!isCancel(e)&&(!e.response||[408,429,500,502,503,504].includes(e.response.status)),message:errorMessage,delivered:message=>listeners.forEach(l=>l(message))})
