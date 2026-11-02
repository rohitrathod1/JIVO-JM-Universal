import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { placeAt, searchPlaces, sendLocation, type Message, type Place } from '../modules/messenger/api'
import { currentLocation } from '../modules/messenger/location/device'
import { DEFAULT_CENTER, validLocation, type LatLng, type PickedLocation } from '../modules/messenger/location/model'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { Button, Field, Label } from '../ui'
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
  const verb = mode === 'pick' ? 'Use' : 'Send'
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
      <Label>{review.latitude.toFixed(6)}, {review.longitude.toFixed(6)}{review.accuracy !== null ? ` · Accurate to ${review.accuracy} m` : ''}</Label>
      <Field label="Name (optional)" value={name} onChangeText={value => { touched.current.name = true; setName(value) }} maxLength={120} editable={!busy} />
      <Field label="Address" value={address} onChangeText={value => { touched.current.address = true; setAddress(value) }} maxLength={300} multiline editable={!busy} />
      <Label>{resolving ? 'Finding the address…' : 'Add the house or plot number, block and floor if needed.'}</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Back" variant="secondary" disabled={busy} onPress={() => setReview(null)} /><Button title={verb} disabled={busy || !final || !validLocation(final)} onPress={() => void submit()} /></View>
    </> : <>
      <Field label="Search for a place" value={term} onChangeText={setTerm} onSubmitEditing={() => setQuery(term.trim())} returnKeyType="search" maxLength={200} />
      {!!term && <Button title="Clear search" variant="ghost" onPress={() => { setTerm(''); setQuery('') }} />}
      {term.trim().length >= 2 ? <>
        {term.trim() !== query ? <Label>Searching when you stop typing · Enter to search now</Label> : searching ? <ActivityIndicator accessibilityLabel="Searching places" /> : <>
          {!!searchError && <Label>{searchError}</Label>}
          {!results.length && !searchError && <Label>No places found. Move the map to the place and send the pin instead.</Label>}
          {results.map((place, index) => <Button key={`${place.latitude}:${place.longitude}:${index}`} title={`${place.name} · ${place.address}`} variant="secondary" onPress={() => choose(place)} />)}
        </>}
      </> : <>
        <LocationMap center={center} interactive onMove={moved} />
        <Label>{center.latitude.toFixed(6)}, {center.longitude.toFixed(6)}</Label>
        <Button title={locating ? 'Finding your location…' : 'Find my location'} variant="secondary" disabled={locating} onPress={() => void locate()} />
        {!!fixError && <Label>{fixError}</Label>}
        {fix && <Label>{fix.accuracy !== null ? `Accurate to ${fix.accuracy} m` : 'Your device’s position'}</Label>}
        {!!fix?.accuracy && fix.accuracy > 1000 && <Label>Approximate: move the map to the exact spot, or search.</Label>}
        <Button title={`${verb} your current location`} disabled={!fix} onPress={() => { if (fix) reviewPoint(fix) }} />
        {pin && <><Label>{pin.name || 'Pinned location'}{pin.address ? ` · ${pin.address}` : ''}</Label><Button title={`${verb} this location`} onPress={() => reviewPoint(pin)} /></>}
        <Label>Move the map to place the pin exactly, or search.</Label>
      </>}
    </>}
    {!!error && <Label>{error}</Label>}
    <Button title="Close location" variant="ghost" disabled={busy} onPress={onClose} />
  </Sheet>
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
