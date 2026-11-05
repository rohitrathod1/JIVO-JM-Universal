import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Linking, PanResponder, Text, View, useWindowDimensions } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { createVoicePort } from '../modules/messenger/media/voice'
import { VoiceController } from '../modules/messenger/media/voiceController'
import type { PickedFile } from '../modules/messenger/media/model'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { Button, useColors } from '../ui'
import { Icon } from './Icon'

function Playback({ uri }: { uri: string }) {
 const player = useAudioPlayer({ uri }); const status = useAudioPlayerStatus(player)
 return <Button size="sm" variant="secondary" title={status.playing ? 'Pause' : 'Play'} onPress={() => { if (status.playing) player.pause(); else { if (status.didJustFinish) void player.seekTo(0); player.play() } }} />
}
export function VoiceRecorder({ disabled, onSend }: { disabled: boolean; onSend: (file: PickedFile) => Promise<void> }) {
 const c = useColors(); const { width } = useWindowDimensions()
 const [voice] = useState(() => new VoiceController(createVoicePort))
 const state = useSyncExternalStore(voice.subscribe, voice.snapshot, voice.snapshot)
 const [seconds, setSeconds] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
 const press = useRef<number | null>(null); const client = useRef(true)
 useEffect(() => { client.current = true; const off = subscribeSensitiveView(active => { if (!active && voice.snapshot().phase === 'recording') void voice.cancel() }); return () => { client.current = false; off(); void voice.cancel() } }, [voice])
 useEffect(() => { if (state.phase !== 'recording') return; const start = Date.now(); const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 250); return () => clearInterval(timer) }, [state.phase])
 const cancel = () => { press.current = null; void voice.cancel(); setError('') }
 /* PanResponder stores these callbacks; refs and the clock are accessed only during gestures. */
 /* eslint-disable react-hooks/refs, react-hooks/purity */
 const responder = PanResponder.create({
  onStartShouldSetPanResponder: () => !disabled && !busy,
  onPanResponderGrant: () => { if (voice.snapshot().phase !== 'idle') return; press.current = Date.now(); setSeconds(0); setError(''); void voice.start() },
  onPanResponderMove: (_e, gesture) => { if (press.current && gesture.dx < -90) cancel() },
  onPanResponderRelease: () => { const at = press.current; press.current = null; if (at && Date.now() - at >= 400 && voice.snapshot().phase === 'recording') void voice.stop() },
  onPanResponderTerminate: cancel,
  onPanResponderTerminationRequest: () => false,
 })
 /* eslint-enable react-hooks/refs, react-hooks/purity */
 const visible = state.phase !== 'idle' || !!state.error || !!error
 return <View style={{ zIndex: 20 }}>
  <View {...responder.panHandlers} accessible accessibilityRole="button" accessibilityLabel="Hold to record a voice message" accessibilityState={{ disabled }} accessibilityActions={[{ name: 'activate', label: 'Start recording' }]} onAccessibilityAction={() => { if (!disabled) void voice.start() }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, opacity: disabled ? 0.5 : 1 }}><Icon name="mic" size={22} color="#ffffff" /></View>
  {visible && <View style={{ position: 'absolute', right: 0, bottom: 52, width: Math.min(width - 24, 500), padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, gap: 10 }}>
   {!!(state.error || error) && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error || state.error}</Text>}
   {state.phase === 'preparing' && <Text style={{ color: c.muted }}>Allow microphone access to record.</Text>}
   {state.phase === 'recording' && <><Text style={{ color: c.danger }}>Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Text><Text style={{ color: c.muted }}>Release to review. Slide left to cancel.</Text></>}
   {state.phase === 'stopping' && <Text style={{ color: c.muted }}>Preparing recording...</Text>}
   <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
    {state.error.toLowerCase().includes('permission') && <Button size="sm" variant="secondary" title="Settings" onPress={() => { void Linking.openSettings().catch(() => setError('Enable microphone access in your device or browser settings.')) }} />}
    <Button size="sm" variant="ghost" title={state.error ? 'Dismiss' : 'Discard'} disabled={busy} onPress={cancel} />
    {state.phase === 'recording' && <Button size="sm" title="Stop" onPress={() => { void voice.stop() }} />}
    {state.asset && <><Playback uri={state.asset.uri} /><Button size="sm" title="Send" loading={busy} onPress={() => { if (!state.asset || busy) return; setBusy(true); void onSend(state.asset).then(() => voice.cancel()).catch(e => { if (client.current) setError(e instanceof Error ? e.message : 'Could not save recording. Try again.') }).finally(() => { if (client.current) setBusy(false) }) }} /></>}
   </View>
  </View>}
 </View>
}
