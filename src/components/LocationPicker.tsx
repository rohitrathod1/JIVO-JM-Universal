import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { placeAt, searchPlaces, sendLocation, type Message, type Place } from '../modules/messenger/api'
import { currentLocation } from '../modules/messenger/location/device'
import { DEFAULT_CENTER, validLocation, type LatLng, type PickedLocation } from '../modules/messenger/location/model'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { accuracyLabel, approximateFix, distanceLabel } from '../modules/messenger/location/format'
import { Button, Field, Label, useColors } from '../ui'
import { Icon, type IconName } from './Icon'
import { Sheet } from './Sheet'
import { LocationMap } from './LocationMap'

export function LocationPicker({ onClose, onSend, mode = 'send' }: { onClose: () => void; onSend: (place: PickedLocation) => Promise<void> | void; mode?: 'send' | 'pick' }) {
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER)
  const [fix, setFix] = useState<PickedLocation | null>(null); const [fixError, setFixError] = useState('')
  const [locating, setLocating] = useState(false); const [pin, setPin] = useState<PickedLocation | null>(null)
  const [term, setTerm] = useState(''); const [query, setQuery] = useState('')
  const [review, setReview] = useState<PickedLocation | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [name, setName] = useState(''); const [address, setAddress] = useState(''); const [resolving, setResolving] = useState(false)
  const touched = useRef({ name: false, address: false }); const alive = useRef(true); const locateRun = useRef(0); const centered = useRef(false)
  const searchAbort = useRef<AbortController | null>(null)
  const loadSearch = useCallback(() => {
    searchAbort.current?.abort(); const controller = new AbortController(); searchAbort.current = controller
    return query.length >= 2 ? searchPlaces(query, center, controller.signal) : Promise.resolve([])
  }, [query, center])
  const search = useResource(loadSearch); const results = search.value ?? []; const searching = query.length >= 2 && search.loading; const searchError = search.error ? errorMessage(search.error) : ''
  useEffect(() => { const cancel = () => searchAbort.current?.abort(); return cancel }, [])
  const locate = useCallback(async () => {
    const token = ++locateRun.current; setLocating(true); setFixError('')
    try {
      const value = await currentLocation()
      if (!alive.current || locateRun.current !== token) return
      setFix(value)
      if (!centered.current) { centered.current = true; setCenter(value) }
    } catch (e) { if (alive.current && locateRun.current === token) setFixError(errorMessage(e)) }
    finally { if (alive.current && locateRun.current === token) setLocating(false) }
  }, [])
  useEffect(() => {
    alive.current = true
    // Open the permission prompt after the sheet mounts; StrictMode cleanup cancels the first attempt.
    const timer = setTimeout(() => void locate(), 0)
    const cancel = () => { alive.current = false; locateRun.current++; clearTimeout(timer) }
    return cancel
  }, [locate])
  useEffect(() => { const timer = setTimeout(() => setQuery(term.trim()), 3000); return () => clearTimeout(timer) }, [term])
  useEffect(() => {
    if (!pin || pin.address) return
    let active = true
    const timer = setTimeout(() => { void placeAt(pin.latitude, pin.longitude).then(place => { if (active && place) setPin(value => value && value.latitude === pin.latitude && value.longitude === pin.longitude ? { ...value, name: place.name, address: place.address } : value) }).catch(() => {}) }, 700)
    return () => { active = false; clearTimeout(timer) }
  }, [pin])
  useEffect(() => {
    if (!review || review.address) return
    let active = true
    void placeAt(review.latitude, review.longitude).then(place => { if (active && place) { if (!touched.current.name) setName(place.name); if (!touched.current.address) setAddress(place.address) } }).catch(() => {}).finally(() => { if (active) setResolving(false) })
    return () => { active = false }
  }, [review])
  const reviewPoint = (point: PickedLocation) => { touched.current = { name: false, address: false }; setName(point.name); setAddress(point.address); setError(''); setResolving(!point.address); setReview(point) }
  const moved = useCallback((point: LatLng) => { centered.current = true; setCenter(point); setPin({ ...point, accuracy: null, name: '', address: '' }) }, [])
  const choose = (place: Place) => { centered.current = true; setCenter(place); setPin({ ...place, accuracy: null }); setTerm(''); setQuery('') }
  const verb = mode === 'pick' ? 'Use' : 'Send'; const c = useColors()
  const final = review ? { ...review, name: name.trim(), address: address.trim() } : null
  async function submit() {
    if (busy || !final || !validLocation(final)) return
    setBusy(true); setError('')
    try { await onSend(final); if (alive.current) onClose() }
    catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  return <Sheet visible onClose={() => { if (!busy) onClose() }}>
    <Label large>{review ? 'Location details' : mode === 'pick' ? 'Choose location' : 'Send location'}</Label>
    {review ? <>
      <LocationMap center={review} initialZoom={17} height={170} />
      <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>{review.latitude.toFixed(6)}, {review.longitude.toFixed(6)}{review.accuracy !== null ? ` · ${accuracyLabel(review.accuracy)}` : ''}</Text>
      <Field label="Name (optional)" placeholder="e.g. Home, Office, Plot 14" value={name} onChangeText={value => { touched.current.name = true; setName(value) }} maxLength={120} editable={!busy} />
      <Field label="Address" value={address} onChangeText={value => { touched.current.address = true; setAddress(value) }} maxLength={300} multiline editable={!busy} />
      <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 12 }}>{resolving ? 'Finding the address…' : 'Add the house or plot number, block and floor if needed.'}</Text>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Button title="Back" variant="secondary" disabled={busy} onPress={() => setReview(null)} /><Button title={busy ? `${verb === 'Use' ? 'Using' : 'Sending'}…` : verb} disabled={busy || !final || !validLocation(final)} onPress={() => void submit()} /></View>
    </> : <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 999, backgroundColor: c.panel, paddingLeft: 16, paddingRight: 4, minHeight: 48 }}>
        <Icon name="search" size={16} />
        <TextInput selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent" value={term} onChangeText={setTerm} onSubmitEditing={() => setQuery(term.trim())} returnKeyType="search" maxLength={200} placeholder="Search for a place or address" placeholderTextColor={c.muted} accessibilityLabel="Search for a place" style={{ flex: 1, minWidth: 0, fontFamily: 'Inter_400Regular', fontSize: 16, color: c.text, paddingHorizontal: 0, paddingVertical: 12, includeFontPadding: false }} />
        {!!term && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setTerm(''); setQuery('') }} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 18, lineHeight: 20 }}>×</Text></Pressable>}
      </View>
      {term.trim().length >= 2 ? <View accessibilityLabel="Places found">
        {term.trim() !== query ? <Status>Searching when you stop typing · Enter to search now</Status> : searching ? <View style={{ paddingVertical: 12 }}><ActivityIndicator accessibilityLabel="Searching places" color={c.brand} /></View> : <>
          {!!searchError && <Status danger>Search is unavailable right now.</Status>}
          {!results.length && !searchError && <Status>No places found. Move the map to the place and send the pin instead.</Status>}
          {results.map((place, index) => <Row key={`${place.latitude}:${place.longitude}:${index}`} first={index === 0} icon="pin" iconColor="#ef4444" title={place.name} subtitle={place.address} trailing={distanceLabel(place.distance_km)} onPress={() => choose(place)} />)}
        </>}
      </View> : <>
        <LocationMap center={center} interactive onMove={moved} height={300} overlay={<Pressable accessibilityRole="button" accessibilityLabel={locating ? 'Finding your location' : 'Go to my location'} disabled={locating} onPress={() => { centered.current = false; void locate() }} style={{ position: 'absolute', right: 12, bottom: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>{locating ? <ActivityIndicator color={c.brand} /> : <Icon name="home" size={20} color={c.brand} />}</Pressable>} />
        <View>
          <Row first icon="send" iconColor={c.brand} iconBg={c.soft} title={`${verb} your current location`} subtitle={fix ? accuracyLabel(fix.accuracy) : fixError || 'Finding your location…'} warning={approximateFix(fix?.accuracy) ? 'Approximate: move the map to the exact spot, or search.' : ''} disabled={!fix || busy} onPress={() => { if (fix) reviewPoint(fix) }} />
          {pin && <Row icon="pin" iconColor="#ef4444" iconBg={c.dangerSoft} title={`${verb} this location`} subtitle={[pin.name, pin.address].filter(Boolean).join(' · ') || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`} disabled={busy} onPress={() => reviewPoint(pin)} />}
        </View>
        <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 12 }}>Move the map to place the pin exactly, or search. Maps © OpenStreetMap contributors.</Text>
      </>}
    </>}
    {!!error && <Status danger>{error}</Status>}
    <Button title="Close location" variant="ghost" disabled={busy} onPress={onClose} />
  </Sheet>
}

function Status({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  const c = useColors()
  return <Text style={{ paddingVertical: 12, textAlign: 'center', fontSize: 14, color: danger ? c.danger : c.muted }}>{children}</Text>
}

/** Reference list row: round icon, medium title, muted subtitle; the whole row is the target (pointer cursor on web). */
function Row({ icon, iconColor, iconBg, title, subtitle, trailing, warning, first = false, disabled = false, onPress }: { icon: IconName; iconColor: string; iconBg?: string; title: string; subtitle?: string; trailing?: string; warning?: string; first?: boolean; disabled?: boolean; onPress: () => void }) {
  const c = useColors()
  // Action rows (icon chip) are named by their action, with the status line as the hint; result rows read name and address.
  return <Pressable accessibilityRole="button" accessibilityLabel={iconBg ? title : [title, subtitle].filter(Boolean).join(', ')} accessibilityHint={iconBg ? subtitle : undefined} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={state => ({ flexDirection: 'row', alignItems: iconBg ? 'center' : 'flex-start', gap: 12, paddingVertical: iconBg ? 12 : 10, paddingHorizontal: 4, borderTopWidth: first ? 0 : 1, borderColor: c.border, backgroundColor: state.pressed || (state as { hovered?: boolean }).hovered ? c.neutral : 'transparent', opacity: disabled ? 0.6 : 1, cursor: disabled ? 'auto' : 'pointer' })}>
    {iconBg ? <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={iconColor} /></View> : <View style={{ paddingTop: 2 }}><Icon name={icon} size={20} color={iconColor} /></View>}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: c.text }}>{title}</Text>
      {!!subtitle && <Text numberOfLines={2} style={{ fontSize: 12, color: c.muted }}>{subtitle}</Text>}
      {!!warning && <Text style={{ fontSize: 12, color: c.gold }}>{warning}</Text>}
    </View>
    {!!trailing && <Text style={{ fontSize: 12, color: c.muted, fontVariant: ['tabular-nums'] }}>{trailing}</Text>}
  </Pressable>
}

export function LocationComposer({ conversation, onSent, onClose }: { conversation: string; onSent: (message: Message) => void; onClose: () => void }) {
  const request = useRef({ key: '', id: randomUUID() })
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  return <LocationPicker onClose={onClose} onSend={async location => {
    const key = JSON.stringify(location)
    if (request.current.key !== key) request.current = { key, id: randomUUID() }
    const message = await sendLocation(conversation, { ...location, client_id: request.current.id })
    if (active.current) onSent(message)
  }} />
}
