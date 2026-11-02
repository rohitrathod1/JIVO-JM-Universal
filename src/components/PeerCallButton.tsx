import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, View } from 'react-native'
import { getPerson, type ConversationItem, type PersonProfile } from '../modules/messenger/api'
import { useResource } from '../shared/useResource'
import { safeTelHref } from '../shared/phone'
import { realtime } from '../core/realtime/socket'
import { errorMessage } from '../core/api/client'
import { Button, Label } from '../ui'

/** The server decides whether this person may see the number. This opens the OS dialer, not a JM call. */
export function ProfileCallButton({ profile }: { profile: PersonProfile }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  if (!profile.is_active || !safeTelHref(profile.phone)) return null
  async function dial() {
    if (busy) return
    setBusy(true); setError('')
    try {
      // Re-check privacy/active status at the action, rather than relying on an old profile response.
      const current = await getPerson(profile.id)
      const href = current.is_active ? safeTelHref(current.phone) : null
      if (!alive.current) return
      if (!href) throw new Error('This mobile number is no longer available.')
      await Linking.openURL(href)
    } catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  return <View style={{ gap: 4 }}><Button title="Call" accessibilityLabel={`Call ${profile.phone}`} variant="ghost" disabled={busy} onPress={() => void dial()} />{!!error && <Label>{error}</Label>}</View>
}

export function PeerCallButton({ conversation }: { conversation: ConversationItem }) {
  const peer = conversation.kind === 'direct' && !conversation.is_self && conversation.peer?.is_active && !conversation.locked ? conversation.peer.id : null
  const load = useCallback(() => peer ? getPerson(peer) : Promise.resolve(null), [peer])
  const resource = useResource(load)
  useEffect(() => realtime.on('RESYNC', resource.refresh), [resource.refresh])
  return peer && resource.value ? <ProfileCallButton key={peer} profile={resource.value} /> : null
}
