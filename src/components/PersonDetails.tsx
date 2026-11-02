import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { getPerson, openDirect, type PersonCard } from '../modules/messenger/api'
import { useResource } from '../shared/useResource'
import { errorMessage } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { Button, Card, Label } from '../ui'
import { Sheet } from './Sheet'
import { useSession } from '../core/auth/Session'

export function PersonDetails({ person, onClose }: { person: PersonCard; onClose: () => void }) {
  const { me } = useSession(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback(() => getPerson(person.id), [person.id]); const resource = useResource(load)
  useEffect(() => realtime.on('RESYNC', resource.refresh), [resource.refresh])
  const profile = resource.value
  return <Sheet visible onClose={onClose}><Label large>{profile?.name ?? person.name}</Label>
    {resource.loading && <ActivityIndicator />}
    {!!resource.error && <><Label>{errorMessage(resource.error)}</Label><Button title="Retry profile" onPress={resource.refresh} /></>}
    {profile && <><Label>{profile.full_name}</Label><Label>{profile.bio}</Label><Label>{profile.email}</Label>
      {profile.phone && <Label>{profile.phone}</Label>}
      {profile.companies.map(company => <Card key={company.id}><Label>{company.company_name}</Label><Label>{[company.title, company.department].filter(Boolean).join(' · ')}</Label></Card>)}
      {!profile.is_active && <Label>This account is inactive.</Label>}
      {profile.is_active && profile.id !== me?.id && <Button title="Message this person" disabled={busy} onPress={() => {
        setBusy(true); setError(''); void openDirect(profile.id).then(conversation => { onClose(); router.push(`/messenger?conversation=${conversation.id}`) }).catch(e => setError(errorMessage(e))).finally(() => setBusy(false))
      }} />}
    </>}
    {!!error && <Label>{error}</Label>}<Button title="Close profile" onPress={onClose} />
  </Sheet>
}
