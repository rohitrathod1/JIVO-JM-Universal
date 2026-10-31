import type { OutboxStorage, PendingSend } from './outboxController'
let entries:PendingSend[]=[]
export const outboxStorage:OutboxStorage={read:async()=>entries,put:async(entry,create)=>{const found=entries.some(p=>p.owner===entry.owner&&p.payload.client_id===entry.payload.client_id);if(found)entries=entries.map(p=>p.owner===entry.owner&&p.payload.client_id===entry.payload.client_id?entry:p);else if(create)entries=[...entries,entry]},remove:async(owner,client)=>{entries=entries.filter(p=>p.owner!==owner||p.payload.client_id!==client)},clear:async()=>{entries=[]}}
export const outboxStorageNotice='Unsent messages stay in this app session only. Closing the app loses unsent messages.'
