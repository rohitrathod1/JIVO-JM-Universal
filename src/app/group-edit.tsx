import { useCallback, useState } from 'react'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { useSession } from '../core/auth/Session'
import { errorMessage } from '../core/api/client'
import * as chat from '../modules/messenger/api'
import { useResource } from '../shared/useResource'
import { Label, Spinner } from '../ui'
import { ConversationInfoFrame } from '../components/ConversationInfoFrame'
import { GroupEditor, MessagingPermissions } from '../components/ConversationDetails'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { GroupPhoto } from '../components/GroupPhoto'

function EditForm({ initial, onSaved }: { initial: { detail: chat.ConversationDetail; members: chat.Member[] }; onSaved: () => void }) {
 const [data, setData] = useState(initial)
 const [error, setError] = useState('')
 const refresh = () => { void Promise.all([chat.getConversation(data.detail.id), chat.listMembers(data.detail.id)]).then(([detail, members]) => { setData({ detail, members }); setError('') }).catch(e => setError(errorMessage(e))) }
 if (!data.detail.can.edit_info) return <Label>You no longer have permission to edit this group.</Label>
 return <>
  <GroupPhoto detail={data.detail} onChanged={refresh} />
  {!!error && <Label>{error}</Label>}
  <View style={{ gap: 16 }}><GroupEditor detail={data.detail} onSaved={onSaved} /></View>
  <MessagingPermissions detail={data.detail} members={data.members} onSaved={refresh} />
 </>
}
function Editor({ conversation }: { conversation: string }) {
 const load = useCallback(async () => {
  const detail = await chat.getConversation(conversation)
  if (detail.kind !== 'group' || !detail.can.edit_info) throw new Error('You do not have permission to edit this group.')
  return { detail, members: await chat.listMembers(conversation) }
 }, [conversation])
 const resource = useResource(load)
 const back = () => { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/group-info', params: { conversation } }) }
 return <ConversationInfoFrame page visible title="Edit group" onClose={back}>
  {resource.loading && <Spinner />}
  {!!resource.error && <ConnectionStatus error={errorMessage(resource.error)} onRetry={resource.refresh} />}
  {resource.value && <EditForm initial={resource.value} onSaved={back} />}
 </ConversationInfoFrame>
}
export default function GroupEditPage() {
 const { conversation } = useLocalSearchParams<{ conversation?: string }>()
 const { me, status } = useSession()
 if (status === 'loading' || status === 'signing-out') return <Spinner />
 if (!me) return <Redirect href="/login" />
 if (!conversation || typeof conversation !== 'string') return <Redirect href="/messenger" />
 return <Editor conversation={conversation} />
}
