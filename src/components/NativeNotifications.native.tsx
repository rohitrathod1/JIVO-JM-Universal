import { useEffect } from 'react'
import { AppState } from 'react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useSession } from '../core/auth/Session'
import { realtime } from '../core/realtime/socket'
import { notificationTarget } from '../shared/notificationTarget'
import { getPreferences, onPreferencesChanged, type Preferences } from '../modules/notifications/api'
import { quietHours } from '../modules/notifications/feedback'
import { nativePushState, registerNativePush, setupChannels } from '../modules/notifications/nativePush'

export function NativeNotifications() {
  const { me, status } = useSession()
  useEffect(() => {
    if (status !== 'ready' || !me) { void Notifications.dismissAllNotificationsAsync(); return }
    let alive = true; let preferences: Preferences | null = null
    void setupChannels().catch(() => {})
    void getPreferences().then(p => { if (alive) preferences = p }).catch(() => {})
    const changed = onPreferencesChanged(p => { preferences = p })
    Notifications.setNotificationHandler({ handleNotification: async notification => {
      const data = notification.request.content.data ?? {}
      const show = alive && data.owner === me.id && !!preferences?.push_enabled && (data.security === true || !quietHours(preferences)) && !(data.conversation && data.conversation === realtime.focusedConversation())
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show && !!preferences?.sound_enabled, shouldSetBadge: false }
    } })
    const open = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data ?? {}
      if (!alive || data.owner !== me.id) return
      const target = notificationTarget(typeof data.url === 'string' ? data.url : '')
      if (target) router.push(target)
      void Notifications.clearLastNotificationResponseAsync()
    }
    const response = Notifications.addNotificationResponseReceivedListener(open)
    void Notifications.getLastNotificationResponseAsync().then(value => { if (value) open(value) })
    const sync = () => { void nativePushState().then(state => { if (alive && state.enabled && state.subscribed && state.granted) return registerNativePush(false, me.id) }).catch(() => {}) }
    sync()
    const token = Notifications.addPushTokenListener(() => sync())
    const app = AppState.addEventListener('change', state => { if (state === 'active') sync() })
    return () => { alive = false; changed(); response.remove(); token.remove(); app.remove(); Notifications.setNotificationHandler(null) }
  }, [me?.id, status, me])
  return null
}
