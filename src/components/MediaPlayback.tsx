import { useCallback, useEffect } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useEvent } from 'expo'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useVideoPlayer, VideoView } from 'expo-video'
import type { Attachment } from '../modules/messenger/api'
import { mediaUrl } from '../modules/messenger/media/url'
import { errorMessage, origin } from '../core/api/client'
import { authenticatedMediaSource, type MediaSource } from '../modules/messenger/media/source'
import { useResource } from '../shared/useResource'
import { subscribeLifecycle } from '../core/realtime/lifecycle'
import { Button, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
function AudioPlayback({ source }: { source: MediaSource }) {
  const c = useColors(); const player = useAudioPlayer(source, { crossOrigin: 'use-credentials', downloadFirst: false, updateInterval: 250 }); const status = useAudioPlayerStatus(player)
  useEffect(() => subscribeLifecycle(active => { if (!active) player.pause() }), [player])
  return <View style={{ gap: 12 }}>
    {!status.isLoaded && !status.error && <ActivityIndicator accessibilityLabel="Loading audio" />}
    {status.error ? <Text accessibilityRole="alert" style={{ color: c.text }}>Unable to play this audio. Check your connection and file access, then reopen it.</Text> : <>
      <Label>{Math.floor(status.currentTime || 0)} / {Math.floor(status.duration || 0)} seconds</Label>
      <Button title={status.playing ? 'Pause audio' : 'Play audio'} disabled={!status.isLoaded} onPress={() => { if (status.playing) player.pause(); else { if (status.didJustFinish) void player.seekTo(0).then(() => player.play()); else player.play() } }} />
      <Button title="Restart audio" disabled={!status.isLoaded} onPress={() => { void player.seekTo(0) }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button title="Back 10 seconds" disabled={!status.isLoaded} onPress={() => { void player.seekTo(Math.max(0, status.currentTime - 10)) }} />
        <Button title="Forward 10 seconds" disabled={!status.isLoaded} onPress={() => { void player.seekTo(Math.min(status.duration, status.currentTime + 10)) }} />
        {[1, 1.5, 2].map(rate => <Button key={rate} title={`${rate}× speed`} disabled={!status.isLoaded} onPress={() => player.setPlaybackRate(rate)} />)}
      </View>
    </>}
  </View>
}
function VideoPlayback({ source }: { source: MediaSource }) {
  const c = useColors(); const player = useVideoPlayer({ ...source, useCaching: false }, value => { value.loop = false; value.staysActiveInBackground = false; value.showNowPlayingNotification = false })
  const status = useEvent(player, 'statusChange', { status: player.status })
  useEffect(() => subscribeLifecycle(active => { if (!active) player.pause() }), [player])
  return <View style={{ gap: 12 }}><VideoView player={player} nativeControls crossOrigin="use-credentials" contentFit="contain" fullscreenOptions={{ enable: true }} style={{ width: '100%', aspectRatio: 16 / 9 }} />{status.status === 'loading' && <ActivityIndicator accessibilityLabel="Loading video" />}{status.status === 'error' && <Text accessibilityRole="alert" style={{ color: c.text }}>Unable to play this video. Check your connection and file access, then reopen it.</Text>}</View>
}
export function MediaPlayback({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const uri = attachment.status === 'ready' ? mediaUrl(attachment.preview_url || attachment.download_url, origin) : null
  const load = useCallback(() => uri ? authenticatedMediaSource(uri) : Promise.resolve(null), [uri]); const resource = useResource(load)
  return <Sheet visible onClose={onClose}><Label large>{attachment.name}</Label>
    {!uri ? <Label>This media is unavailable.</Label> : resource.loading ? <ActivityIndicator accessibilityLabel="Loading media session" /> : resource.error ? <><Label>{errorMessage(resource.error)}</Label><Button title="Retry media" onPress={resource.refresh} /></> : resource.value ? attachment.kind === 'video' ? <VideoPlayback source={resource.value} /> : <AudioPlayback source={resource.value} /> : null}
    <Button title="Close media" onPress={onClose} /></Sheet>
}
