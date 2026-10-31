const fs=require('fs');function write(p,s){fs.writeFileSync(p,s)}function edit(p,a,b){let s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error(p+' marker');write(p,s.replace(a,b))}
write('src/shared/homeTiles.ts',`import { allows, type CapabilityRule } from '../config/capabilities'
const tiles: { title: string; description: string; href: string; rule?: CapabilityRule }[] = [
 { title: 'Messenger', description: 'Conversations, files and your team.', href: '/messenger', rule: 'JM_ACCESS' },
 { title: 'Passwords', description: 'Your vaults and shared passwords.', href: '/passwords', rule: 'JP_ACCESS' },
 { title: 'Profile & security', description: 'Your details, sign-in and devices.', href: '/profile' },
 { title: 'People', description: 'Manage people and access.', href: '/admin?tab=people', rule: 'ADMIN_USERS' },
 { title: 'Permission groups', description: 'Review group permissions.', href: '/admin?tab=groups', rule: ['ADMIN_USERS','ADMIN_AUDIT'] },
 { title: 'Security', description: 'Organization security policy.', href: '/admin?tab=security', rule: 'ADMIN_USERS' },
 { title: 'Alerts', description: 'Send team announcements.', href: '/notifications?view=alerts', rule: 'JM_SEND_ALERT' },
 { title: 'Team vaults', description: 'Manage team vault ownership.', href: '/passwords?view=admin', rule: 'JP_MANAGE_VAULT' },
 { title: 'Emergency access', description: 'Request or review emergency access.', href: '/passwords?view=break-glass', rule: ['JP_BREAK_GLASS','JP_REQUEST_EMERGENCY'] },
]
export const homeTiles = (capabilities: readonly string[]) => tiles.filter(tile => allows(capabilities,tile.rule))
`)
write('src/app/index.tsx',`import { Link, type Href } from 'expo-router'
import { ScrollView, View, useWindowDimensions } from 'react-native'
import { Workspace } from '../components/Workspace'
import { useSession } from '../core/auth/Session'
import { homeTiles } from '../shared/homeTiles'
import { Card, Label, styles, useColors } from '../ui'
export default function Index() {
 const { me } = useSession(); const { width } = useWindowDimensions(); const c = useColors()
 return <Workspace><ScrollView contentContainerStyle={styles.page}><Label large>Welcome, {me?.name || 'there'}</Label><Label>What would you like to do?</Label><View style={{ flexDirection:'row',flexWrap:'wrap',gap:16 }}>{homeTiles(me?.capabilities ?? []).map(tile => <View key={tile.title} style={{ width: width < 700 ? '100%' : '46%', maxWidth:480 }}><Card><Link href={tile.href as Href} style={{ color:c.primary,fontSize:22,fontWeight:'700',paddingVertical:12 }}>{tile.title}</Link><Label>{tile.description}</Label></Card></View>)}</View></ScrollView></Workspace>
}
`)
edit('src/components/Workspace.tsx','const links = [',"const links = [\n    { title: 'Home', href: '/' },")
write('src/components/SelectedSenders.tsx',`import { useState } from 'react'
import { Switch, View } from 'react-native'
import * as chat from '../modules/messenger/api'
import { Button, Card, Label } from '../ui'
import { errorMessage } from '../core/api/client'
export function SelectedSenders({ detail, members, onChanged }: { detail: chat.ConversationDetail; members: chat.Member[]; onChanged: () => void }) {
 const [ids,setIds] = useState(members.filter(m=>m.role==='member' && m.can_send && detail.send_mode==='selected').map(m=>m.user.id)); const [review,setReview] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState('')
 async function save() { setBusy(true);setError('');try { const fresh = await chat.getConversation(detail.id); const current = await chat.listMembers(detail.id); if(!fresh.can.manage_members || ids.some(id=>!current.some(m=>m.user.id===id&&m.role==='member'))) throw Error('Group permissions or membership changed. Reopen these settings.'); await chat.setSendMode(detail.id,'selected',ids);setReview(false);onChanged() }catch(e){setError(errorMessage(e))}finally{setBusy(false)} }
 return <Card><Label>Selected senders</Label><Label>Owners and administrators can still send. Choose additional members.</Label>{members.filter(m=>m.role==='member').map(m=><View key={m.user.id} style={{flexDirection:'row',gap:8,alignItems:'center'}}><View style={{flex:1}}><Label>{m.user.name}</Label></View><Switch accessibilityLabel={'Allow sender '+m.user.name} disabled={busy || review} value={ids.includes(m.user.id)} onValueChange={value=>setIds(old=>value?[...old,m.user.id]:old.filter(id=>id!==m.user.id))}/></View>)}{!!error&&<Label>{error}</Label>}<Button title="Review selected senders" disabled={busy||review} onPress={()=>setReview(true)}/>{review&&<><Label>Allow administrators and {ids.length} selected members to send?</Label><Button title="Confirm selected senders" disabled={busy} onPress={()=>void save()}/><Button title="Cancel selected senders" disabled={busy} onPress={()=>setReview(false)}/></>}</Card>
}
`)
edit('src/components/ConversationDetails.tsx',"import { Sheet } from './Sheet'","import { Sheet } from './Sheet'\nimport { SelectedSenders } from './SelectedSenders'")
edit('src/components/ConversationDetails.tsx','<Label>Who can send</Label>',`<SelectedSenders key={JSON.stringify([detail.send_mode,resource.value?.members])} detail={detail} members={resource.value?.members ?? []} onChanged={() => { resource.refresh(); onChanged() }} /><Label>Who can send</Label>`)
// Reuse exact original plain-text mention helpers, independent of browser APIs.
fs.copyFileSync('../JIVO-JM-Frontend/src/modules/messenger/lib/text.ts','src/modules/messenger/lib/text.ts')
write('src/components/MessageDetails.tsx',`import { useCallback } from 'react'
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
`)
edit('src/components/ConversationWorkspace.tsx',"import { arrivalBehavior }", "import { MessageDetails } from './MessageDetails'\nimport { withMentionTokens } from '../modules/messenger/lib/text'\nimport { useConversationLive } from '../modules/messenger/useConversationLive'\nimport { arrivalBehavior }")
edit('src/components/ConversationWorkspace.tsx','const messages = historyState.window.messages',"const live = useConversationLive(preview ? null : selected, me?.id ?? '')\n  const [info,setInfo] = useState<chat.Message | null>(null)\n  const messages = historyState.window.messages")
edit('src/components/ConversationWorkspace.tsx','body: body.trim(), upload_ids:', 'body: withMentionTokens(body.trim(), live.members), upload_ids:')
edit('src/components/ConversationWorkspace.tsx','if (editing) await chat.editMessage(editing.id, body.trim())','live.stop()\n      if (editing) await chat.editMessage(editing.id, withMentionTokens(body.trim(), live.members))')
edit('src/components/ConversationWorkspace.tsx',"<Label large>{selected.title || selected.peer?.name}</Label>","<Label large>{selected.title || selected.peer?.name}</Label>{!!live.label && <Label>{live.label}</Label>}")
edit('src/components/ConversationWorkspace.tsx','{selected.can.send ? <View',`{selected.can.send && /(^|\\s)@[^@\\n]*$/.test(body) && <ScrollView horizontal style={{maxHeight:52}} contentContainerStyle={{gap:8}}>{live.members.filter(m=>!m.is_me&&m.user.name.toLowerCase().includes(body.slice(body.lastIndexOf('@')+1).toLowerCase())).slice(0,8).map(m=><Button key={m.user.id} title={'Mention '+m.user.name} disabled={blocked} onPress={()=>{setBody(body.slice(0,body.lastIndexOf('@'))+'@'+m.user.name+' ');draftId.current=randomUUID()}}/>)}</ScrollView>}\n          {selected.can.send ? <View`)
edit('src/components/ConversationWorkspace.tsx','onChangeText={v => { setBody(v); draftId.current = randomUUID() }}','onBlur={live.stop} onChangeText={v => { setBody(v); draftId.current = randomUUID(); live.typing() }}')
edit('src/components/ConversationWorkspace.tsx','{forwarding && <ForwardMessage',"{info && <MessageDetails message={info} onClose={()=>setInfo(null)} />}\n    {forwarding && <ForwardMessage")
edit('src/components/ConversationWorkspace.tsx','<Label large>Message actions</Label>','<Label large>Message actions</Label>{actions && <Button title="Message information" onPress={()=>{setInfo(actions);setActions(null)}}/>}')
console.log('Home, selected senders, mention and message information source written')
