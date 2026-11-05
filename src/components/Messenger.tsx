import { useCallback } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Messenger as ConversationWorkspace } from './ConversationWorkspace'
import { useSession } from '../core/auth/Session'
import { useResource } from '../shared/useResource'
import { getConversation } from '../modules/messenger/api'
import { Label } from '../ui'
import { ConnectionStatus } from './ConnectionStatus'
import { errorMessage } from '../core/api/client'
function LinkedConversation({ id, seq }: { id: string; seq?: number }) { const load = useCallback(() => getConversation(id), [id]); const resource = useResource(load); if (resource.loading) return <ActivityIndicator />; if (resource.error) { const status = (resource.error as { response?: { status?: number }; status?: number }).response?.status ?? (resource.error as { status?: number }).status; if (status === 404 || status === 403) return <View style={{ flex: 1 }}><Label>{"This chat isn't available. It may have been deleted, or you are no longer a member."}</Label><ConversationWorkspace /></View>; return <ConnectionStatus error={errorMessage(resource.error)} onRetry={resource.refresh} /> } return resource.value ? <ConversationWorkspace initialConversation={resource.value} initialSeq={seq} /> : null }
export function Messenger({ preview = false, conversation, seq }: { preview?: boolean; conversation?: string; seq?: number }) { const { me } = useSession(); if (!preview && !me?.capabilities.includes('JM_ACCESS')) return <Label>Messenger access is not enabled for your account.</Label>; return conversation ? <LinkedConversation key={conversation + ':' + seq} id={conversation} seq={seq} /> : <ConversationWorkspace preview={preview} /> }
