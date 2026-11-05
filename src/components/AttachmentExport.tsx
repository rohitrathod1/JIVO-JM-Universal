import { chatLock } from '../modules/messenger/chatLock'
import { getConversation } from '../modules/messenger/api'
import { useEffect,useRef,useState } from 'react'
import { api,errorMessage } from '../core/api/client'
import type { Attachment,MessageWindow } from '../modules/messenger/api'
import { exportMessageAttachment } from '../modules/messenger/media/attachmentExport'
import { attachmentExportNotice,cancelAttachmentExports,saveAttachment,validateAttachmentExportSize } from '../modules/messenger/media/export'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { Button,Label } from '../ui'
import { Sheet } from './Sheet'
export function AttachmentExport({conversation,message,seq,attachment,onClose}:{conversation:string;message:string;seq:number;attachment:Attachment;onClose:()=>void}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const abort=useRef<AbortController|null>(null);const active=useRef(true);const generation=useRef(0)
 useEffect(()=>{const invalidate=()=>{generation.current++;abort.current?.abort()};const off=subscribeSensitiveView(value=>{active.current=value;if(!value){generation.current++;abort.current?.abort()}});return()=>{off();active.current=false;invalidate();cancelAttachmentExports()}},[])
 const close=()=>{generation.current++;abort.current?.abort();cancelAttachmentExports();onClose()}
 async function save(){if(busy||!active.current)return;const token=++generation.current;const controller=new AbortController();abort.current=controller;setBusy(true);setError('');setNotice('');const current=()=>active.current&&generation.current===token;try{await exportMessageAttachment({message,attachment:attachment.id},controller.signal,current,{window:async()=>{const detail=await getConversation(conversation);if(detail.locked&&!chatLock.snapshot().unlocked)throw new Error('Unlock this chat before exporting attachments.');if(!current())throw new Error('Export cancelled.');return(await api.get<MessageWindow>(`/conversations/${conversation}/messages/`,{params:{around:seq},signal:controller.signal})).data},download:async path=>(await api.get<Blob>(path,{responseType:'blob',timeout:120000,signal:controller.signal})).data,validate:validateAttachmentExportSize,save:saveAttachment});if(current())setNotice('Export handoff finished. JM cannot confirm that the destination saved the file.')}catch(e){if(current())setError(errorMessage(e))}finally{if(abort.current===controller)abort.current=null;setBusy(false)}}
 return <Sheet visible onClose={close}><Label large>Export attachment</Label><Label>{attachment.name}</Label><Label>{attachmentExportNotice}</Label>{!!error&&<Label>{error}</Label>}{!!notice&&<Label>{notice}</Label>}<Button title="Confirm attachment export" disabled={busy} onPress={()=>void save()}/><Button title={busy?'Cancel attachment export':'Close attachment export'} onPress={close}/></Sheet>
}
