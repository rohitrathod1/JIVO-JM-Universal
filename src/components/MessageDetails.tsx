import { useCallback } from 'react'
import { ActivityIndicator } from 'react-native'
import * as chat from '../modules/messenger/api'
import { useResource } from '../shared/useResource'
import { errorMessage } from '../core/api/client'
import { Button, Card, Label } from '../ui'
import { Sheet } from './Sheet'
export function MessageDetails({ message, onClose }: { message: chat.Message; onClose: () => void }) {
 const load = useCallback(async()=>({ info:await chat.messageInfo(message.id),reactions:await chat.listReactions(message.id) }),[message.id]); const data=useResource(load)
 return <Sheet visible onClose={onClose}><Label large>Message information</Label>{data.loading&&<ActivityIndicator/>}{!!data.error&&<Label>{errorMessage(data.error)}</Label>}{data.value&&<><Label>Sent: {new Date(data.value.info.sent_at).toLocaleString()}</Label>{(['read_by','delivered_to','pending'] as const).map(key=><Card key={key}><Label>{key==='read_by'?'Read by':key==='delivered_to'?'Delivered to':'Pending delivery'}</Label>{data.value!.info[key].map(person=><Label key={person.id}>{person.name}{person.read_at?' — '+new Date(person.read_at).toLocaleString():person.delivered_at?' — '+new Date(person.delivered_at).toLocaleString():''}</Label>)}</Card>)}<Label large>Reactions</Label>{data.value.reactions.length===0&&<Label>No reactions yet.</Label>}{data.value.reactions.map(r=><Card key={r.emoji}><Label>{r.emoji}</Label>{r.users.map(p=><Label key={p.id}>{p.name}</Label>)}</Card>)}</>}<Button title="Close message information" onPress={onClose}/></Sheet>
}
