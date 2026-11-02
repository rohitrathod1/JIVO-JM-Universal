import { useCallback, useEffect } from 'react'
import { ActivityIndicator } from 'react-native'
import { pollVoters, type PersonCard } from '../modules/messenger/api'
import { useResource } from '../shared/useResource'
import { errorMessage } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { Button, Card, Label } from '../ui'
import { Sheet } from './Sheet'

export function PollVoters({ id, onPerson, onClose }: { id: string; onPerson: (person: PersonCard) => void; onClose: () => void }) {
  const load = useCallback(() => pollVoters(id), [id]); const resource = useResource(load)
  const { refresh } = resource
  useEffect(() => realtime.on<{ message?: string }>('*', frame => {
    if (frame.type === 'RESYNC' || frame.type === 'POLL_UPDATED' && frame.data.message === id) refresh()
  }), [id, refresh])
  return <Sheet visible onClose={onClose}><Label large>Poll votes</Label>
    {resource.loading && <ActivityIndicator />}
    {!!resource.error && <><Label>{errorMessage(resource.error)}</Label><Button title="Retry votes" onPress={resource.refresh} /></>}
    {resource.value?.map(option => <Card key={option.id}><Label>{option.text} · {option.users.length}</Label>
      {option.users.length === 0 && <Label>No votes yet.</Label>}
      {option.users.map(person => <Button key={person.id} title={person.name} onPress={() => onPerson(person)} />)}
    </Card>)}<Button title="Close votes" onPress={onClose} />
  </Sheet>
}
