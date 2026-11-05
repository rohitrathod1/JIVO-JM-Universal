import { ProfileSection } from './ProfileSection'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { api, errorMessage } from '../core/api/client'
import { formatDate } from '../shared/utils/format'
import { Button, useColors } from '../ui'

interface Notice { id: string; title: string; body: string; created_at: string }
interface NoticePage { results: Notice[]; next_cursor: string | null; unavailable_count: number }

/** Reference profile SecurityNotices: sign-in and account changes, newest first, older pages on request. */
export function SecurityNotices({ userId }: { userId: string }) {
  const c = useColors()
  const [notices, setNotices] = useState<Notice[]>([]); const [cursor, setCursor] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false); const [loading, setLoading] = useState(true); const [more, setMore] = useState(false); const [error, setError] = useState('')
  const generation = useRef(0)
  const load = useCallback(async (from: string | null) => {
    const at = from ? generation.current : ++generation.current
    if (from) setMore(true); else { setLoading(true); setNotices([]) }
    setError('')
    try {
      const { data } = await api.get<NoticePage>('/me/security-notices/', { params: { cursor: from } })
      if (at !== generation.current) return
      setNotices(old => from ? [...old, ...data.results] : data.results); setCursor(data.next_cursor ?? null)
      if (data.unavailable_count > 0) setUnavailable(true); else if (!from) setUnavailable(false)
    } catch (e) { if (at === generation.current) setError(errorMessage(e)) }
    finally { if (at === generation.current) { setLoading(false); setMore(false) } }
  }, [])
  // Deferred a tick so the first load's state updates do not run synchronously inside the effect.
  useEffect(() => { const t = setTimeout(() => void load(null), 0); return () => clearTimeout(t) }, [load, userId])
  const text = { color: c.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 } as const
  return <ProfileSection title="Security notices">
    <Text style={{ ...text, color: c.muted, marginTop: 4 }}>Sign-in and account changes for your account.</Text>
    {loading && <View style={{ paddingVertical: 12 }}><ActivityIndicator color={c.brand} /></View>}
    {!!error && <View style={{ marginTop: 12, gap: 8, alignItems: 'flex-start' }}><Text accessibilityRole="alert" style={{ ...text, color: c.danger }}>{error}</Text><Button size="sm" variant="secondary" title="Retry" accessibilityLabel="Retry security notices" onPress={() => void load(null)} /></View>}
    {!loading && !error && notices.length === 0 && <Text style={{ ...text, marginTop: 12 }}>No available security notices on this page.</Text>}
    {unavailable && <Text style={{ ...text, color: c.muted, marginTop: 12 }}>Some older notices are unavailable.</Text>}
    {notices.length > 0 && <View accessibilityRole="list">{notices.map((n, index) => <View key={n.id} style={{ paddingVertical: 12, borderTopWidth: index === 0 ? 0 : 1, borderColor: c.border }}>
      <Text style={{ ...text, fontFamily: 'Inter_500Medium', fontWeight: '500' }}>{n.title}</Text>
      <Text style={text}>{n.body}</Text>
      <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{formatDate(n.created_at)}</Text>
    </View>)}</View>}
    {!!cursor && <Button size="sm" variant="secondary" title="Load older notices" loading={more} style={{ alignSelf: 'flex-start' }} onPress={() => void load(cursor)} />}
  </ProfileSection>
}
