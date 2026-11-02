import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Linking, Text, View } from 'react-native'
import { router } from 'expo-router'
import { getPerson, openDirect, type PersonCard, type PersonProfile } from '../modules/messenger/api'
import { safeMailHref } from '../modules/messenger/conversationInfo'
import { mediaUrl } from '../modules/messenger/media/url'
import { useResource } from '../shared/useResource'
import { errorMessage, origin } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { Button, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
import { ChatAvatar } from './ChatAvatar'
import { useSession } from '../core/auth/Session'
import { ProfileCallButton, RoundAction } from './PeerCallButton'
import { SharedMedia } from './SharedMedia'

function Heading({ children }: { children: string }) {
  const c = useColors()
  return <Text accessibilityRole="header" style={{ color: c.muted, fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</Text>
}

/** Email and Mobile rows, each with its round mailto: / tel: action on the same line (Frontend ProfilePanel). */
export function PersonContact({ profile, self }: { profile: PersonProfile; self: boolean }) {
  const c = useColors(); const [error, setError] = useState('')
  const mail = safeMailHref(profile.email)
  const row = (label: string, value: string, action: ReactNode, first: boolean) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderColor: c.border }}>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' }}>{label}</Text><Text selectable numberOfLines={1} style={{ color: c.text, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', fontVariant: ['tabular-nums'] }}>{value}</Text></View>
    {action}
  </View>
  return <View accessibilityLabel="Contact" style={{ borderWidth: 1, borderColor: c.border, borderRadius: 16, overflow: 'hidden' }}>
    {row('Email', profile.email, mail && <RoundAction icon="mail" soft label={`Email ${profile.email}`} onPress={() => void Linking.openURL(mail).catch(e => setError(errorMessage(e)))} />, true)}
    {!!profile.phone && row('Mobile', profile.phone, !self && <ProfileCallButton key={profile.id} profile={profile} soft />, false)}
    {!!error && <View style={{ padding: 12 }}><Label>{error}</Label></View>}
  </View>
}

/** Someone's profile body: photo, name, Message, About, contact rows, the direct chat's shared items, companies. */
export function PersonProfileView({ profile, conversation, onMessage, busy }: { profile: PersonProfile; conversation?: string | null; onMessage?: () => void; busy?: boolean }) {
  const c = useColors(); const { me } = useSession(); const self = profile.id === me?.id
  return <View style={{ gap: 20 }}>
    <View style={{ alignItems: 'center', gap: 10 }}>
      <ChatAvatar name={profile.name} seed={profile.id} uri={mediaUrl(profile.avatar_url, origin)} size={120} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 28, textAlign: 'center' }}>{profile.name}</Text>
        {!!profile.full_name && profile.full_name !== profile.name && <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{profile.full_name}</Text>}
        {!profile.is_active && <Text style={{ color: c.danger, fontSize: 14, lineHeight: 20, marginTop: 4 }}>No longer active</Text>}
      </View>
      {!self && profile.is_active && onMessage && <Button title="Message" disabled={busy} onPress={onMessage} />}
    </View>
    {!!profile.bio && <View style={{ gap: 4 }}><Heading>About</Heading><Label>{profile.bio}</Label></View>}
    <PersonContact profile={profile} self={self} />
    {!!conversation && <SharedMedia key={`shared:${conversation}`} conversation={conversation} />}
    {profile.companies.length > 0 && <View style={{ gap: 8 }}><Heading>Companies</Heading>{profile.companies.map(company => <View key={company.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: /^#[0-9a-f]{3,8}$/i.test(company.company_color) ? company.company_color : c.brand }} />
      <View style={{ flex: 1 }}><Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{company.company_name}</Text>{!!(company.title || company.department) && <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>{[company.title, company.department].filter(Boolean).join(' · ')}</Text>}</View>
    </View>)}</View>}
  </View>
}

export function PersonDetails({ person, conversation = null, onClose }: { person: PersonCard; conversation?: string | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback(() => getPerson(person.id), [person.id]); const resource = useResource(load)
  useEffect(() => realtime.on('RESYNC', resource.refresh), [resource.refresh])
  const profile = resource.value
  return <Sheet visible onClose={onClose}><Label large>Profile</Label>
    {resource.loading && !profile && <ActivityIndicator />}
    {!!resource.error && <><Label>{errorMessage(resource.error)}</Label><Button title="Retry profile" onPress={resource.refresh} /></>}
    {profile && <PersonProfileView profile={profile} conversation={conversation} busy={busy} onMessage={() => {
      setBusy(true); setError(''); void openDirect(profile.id).then(chat => { onClose(); router.push(`/messenger?conversation=${chat.id}`) }).catch(e => setError(errorMessage(e))).finally(() => setBusy(false))
    }} />}
    {!!error && <Label>{error}</Label>}<Button title="Close profile" variant="secondary" onPress={onClose} />
  </Sheet>
}
