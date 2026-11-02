import { useEffect } from 'react'
import { Vibration } from 'react-native'
import { useAudioPlayer } from 'expo-audio'
import { realtime } from '../core/realtime/socket'
import { subscribeLifecycle } from '../core/realtime/lifecycle'
import { useSession } from '../core/auth/Session'
import { getPreferences, onPreferencesChanged, type Preferences } from '../modules/notifications/api'
import { FeedbackGate, quietHours } from '../modules/notifications/feedback'
import { getConversation, type Message } from '../modules/messenger/api'

export function LiveFeedback() {
  const { me } = useSession()
  const player = useAudioPlayer(require('../../assets/jm-notify.wav'))
  useEffect(() => {
    let alive = true; let active = true; let preferences: Preferences | null = null
    const gate = new FeedbackGate()
    let revision = 0
    const load = () => { const current = ++revision; void getPreferences().then(value => { if (alive && current === revision) preferences = value }).catch(() => {}) }
    const offPreferences = onPreferencesChanged(value => { revision++; preferences = value })
    const signal = (id: string) => {
      if (!alive || !active || !preferences || quietHours(preferences) || !gate.accept(id)) return
      if (preferences.vibrate_enabled) Vibration.vibrate([0, 120, 60, 120])
      if (preferences.sound_enabled) void player.seekTo(0).then(() => { if (alive && active) player.play() }).catch(() => {})
    }
    const off = realtime.on('*', ({ type, data }) => {
      if (type === 'RESYNC' || type === 'NOTIFICATION_PREFERENCES_UPDATED') load()
      if (type === 'ALERT_PUBLISHED') { signal(`alert:${(data as { id: string }).id}`); return }
      if (type !== 'MESSAGE_CREATED' || !active) return
      const message = data as Message
      if (!message.sender || message.sender.id === me?.id || message.kind === 'system' || realtime.focusedConversation() === message.conversation) return
      void getConversation(message.conversation).then(conversation => {
        const muted = conversation.muted_until && Date.parse(conversation.muted_until) > Date.now()
        const mentioned = preferences?.mentions_override_mute && me && message.mentions.includes(me.id)
        if (!muted || mentioned) signal(message.id)
      }).catch(() => {})
    })
    const lifecycle = subscribeLifecycle(value => { active = value; if (!value) player.pause(); else load() })
    return () => { alive = false; off(); offPreferences(); lifecycle() }
  }, [me?.id, player, me])
  return null
}
