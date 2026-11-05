import { deliverOwned } from './ownedDelivery'
import { isAxiosError,isCancel } from 'axios'
import { api,errorMessage } from '../../core/api/client'
import { sessionLost } from '../../core/api/events'
import { withSessionLock } from '../../core/auth/sessionCoordination'
import { getConversation, sendMessage,type Message, type SendPayload } from './api'
import { OutboxController } from './outboxController'
import { outboxStorage } from './outboxStorage'
import { queuedMedia, type QueuedMedia } from './queuedMedia'
import type { PickedFile } from './media/model'
import { uploadLimitError } from './media/model'
import { uploadAttachment } from './media/upload'
const listeners=new Set<(message:Message)=>void>()
export const onOutboxSent=(listener:(message:Message)=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
export const outbox:OutboxController=new OutboxController({storage: {
 ...outboxStorage,
 read: async owner => { if (owner) await queuedMedia.retain(owner); return outboxStorage.read(owner) },
 remove: async (owner, client) => { await outboxStorage.remove(owner, client); await queuedMedia.remove(owner, client) },
 clear: async () => { await outboxStorage.clear(); await queuedMedia.retain(null) },
},send:async(conversation,payload,signal)=>{const local=outbox.snapshot().entries.find(p=>p.conversation===conversation&&p.payload.client_id===payload.client_id);if(!local)return null;return deliverOwned(local.owner,signal,{lock:withSessionLock,exists:async()=> (await outboxStorage.read()).some(p=>p.owner===local.owner&&p.payload.client_id===payload.client_id),identity:async()=> (await api.get<{id:string}>('/me/',{signal})).data.id,send:async()=>{
 const ids = [...(payload.upload_ids ?? [])]
 if (local.media?.length) {
  const detail = await getConversation(conversation)
  if (!detail.can.send || !detail.can.send_file) throw Error('Sending files is no longer allowed in this chat.')
  for (const [index, item] of local.media.entries()) {
   if (signal.aborted) throw Error('Sending cancelled.')
   let uploadId = item.uploadId
   if (!uploadId) {
    const file = await queuedMedia.open(local.owner, payload.client_id, item)
    try { const upload = await uploadAttachment(file, item.key, signal, value => outbox.progress(payload.client_id, (index + value) / local.media!.length)); uploadId = upload.id; await outbox.uploaded(payload.client_id, item.key, uploadId) } finally { await file.dispose?.() }
   }
   ids.push(uploadId)
  }
 }
 return sendMessage(conversation, { ...payload, upload_ids: ids }, signal, local.owner)
},remove:()=>outboxStorage.remove(local.owner,payload.client_id),mismatch:()=>{outbox.setActive(false);sessionLost()}})},network:e=>Boolean(e && typeof e === 'object' && 'retryable' in e && e.retryable === true)||isAxiosError(e)&&!isCancel(e)&&(!e.response||[408,429,500,502,503,504].includes(e.response.status)),message:errorMessage,delivered:message=>listeners.forEach(l=>l(message))})

export async function enqueueFiles(owner: string, conversation: string, payload: SendPayload, files: { key: string; file: PickedFile }[], attachments: import('./api').Attachment[] = []) {
 const media: QueuedMedia[] = []
 try {
  for (const item of files) { const error = uploadLimitError(item.file); if (error) throw Error(error); media.push(await queuedMedia.save(owner, payload.client_id, item.key, item.file)) }
  await outbox.enqueue(owner, conversation, payload, { media, attachments })
 } catch (error) { await queuedMedia.remove(owner, payload.client_id); throw error }
}
