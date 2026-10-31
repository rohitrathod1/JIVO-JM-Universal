import { useCallback } from 'react'
import { ActivityIndicator } from 'react-native'
import { Messenger as ConversationWorkspace } from './ConversationWorkspace'
import { useSession } from '../core/auth/Session'
import { useResource } from '../shared/useResource'
import { getConversation } from '../modules/messenger/api'
import { Button, Label } from '../ui'
import { errorMessage } from '../core/api/client'
function LinkedConversation({ id, seq }: { id: string; seq?: number }) { const load = useCallback(() => getConversation(id), [id]); const resource = useResource(load); if (resource.loading) return <ActivityIndicator />; if (resource.error) return <><Label>{errorMessage(resource.error)}</Label><Button title="Retry linked conversation" onPress={resource.refresh} /></>; return resource.value ? <ConversationWorkspace initialConversation={resource.value} initialSeq={seq} /> : null }
export function Messenger({ preview = false, conversation, seq }: { preview?: boolean; conversation?: string; seq?: number }) { const { me } = useSession(); if (!preview && !me?.capabilities.includes('JM_ACCESS')) return <Label>Messenger access is not enabled for your account.</Label>; return conversation ? <LinkedConversation key={conversation + ':' + seq} id={conversation} seq={seq} /> : <ConversationWorkspace preview={preview} /> }
