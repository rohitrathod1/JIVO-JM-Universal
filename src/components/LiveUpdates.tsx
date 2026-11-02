import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { router } from 'expo-router'
import { View } from 'react-native'
import { api, errorMessage } from '../core/api/client'
import { useSession } from '../core/auth/Session'
import { realtime } from '../core/realtime/socket'
import { subscribeLifecycle } from '../core/realtime/lifecycle'
import { markDelivered, type Message } from '../modules/messenger/api'
import { activeAlerts, dismissAlert, type JmAlert } from '../modules/notifications/api'
import { emptySummary, visibleAlerts, type UnreadSummary } from '../modules/notifications/live'
import { Button, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
import { LiveFeedback } from './LiveFeedback'

interface LiveState { summary: UnreadSummary; alerts: JmAlert[]; dismiss: (id: string) => Promise<void> }
const Context = createContext<LiveState>({ summary: emptySummary, alerts: [], dismiss: async () => {} })
export const useLiveUpdates = () => useContext(Context)
export function LiveUpdates({ children }: { children: ReactNode }) {
  const { me, status } = useSession()
  return status === 'ready' && me ? <AccountUpdates key={me.id} account={me.id}>{children}</AccountUpdates> : <>{children}</>
}
function AccountUpdates({ account, children }: { account: string; children: ReactNode }) {
  const [summary, setSummary] = useState(emptySummary)
  const [alerts, setAlerts] = useState<JmAlert[]>([])
  const [popups, setPopups] = useState<JmAlert[]>([])
  const [now, setNow] = useState(Date.now)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true; let active = true; let generation = 0; let summaryRevision = 0
    const received = new Map<string, number>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let messageSummaryTimer: ReturnType<typeof setTimeout> | undefined
    const refresh = async () => {
      if (!active) return
      const current = ++generation
      const summaryAtStart = summaryRevision
      const result = await Promise.allSettled([api.get<UnreadSummary>('/notifications/summary/'), activeAlerts()])
      if (!alive || current !== generation) return
      if (result[0].status === 'fulfilled' && summaryAtStart === summaryRevision) setSummary(result[0].value.data)
      if (result[1].status === 'fulfilled') setAlerts(result[1].value)
    }
    const off = realtime.on('*', ({ type, data }) => {
      if (!alive || !active) return
      if (type === 'UNREAD_SUMMARY') { summaryRevision++; setSummary(data as UnreadSummary) }
      if (type === 'MESSAGE_CREATED') {
        const message = data as Message
        if (message?.sender?.id && message.sender.id !== account && message.kind !== 'system' && message.seq > (received.get(message.conversation) ?? 0)) {
          received.set(message.conversation, message.seq)
          // Delivery means this device received the event. Read is still tied to visible messages.
          void markDelivered(message.conversation, message.seq).catch(() => { received.delete(message.conversation) })
          if (!messageSummaryTimer) messageSummaryTimer = setTimeout(() => { messageSummaryTimer = undefined; void refresh() }, 2000)
        }
      }
      if (type === 'ALERT_PUBLISHED') {
        const alert = data as JmAlert
        if (alert?.id) {
          setAlerts(old => [...old.filter(item => item.id !== alert.id), alert])
          setPopups(old => old.some(item => item.id === alert.id) ? old : [...old, alert])
        }
      }
      if (type === 'ALERT_CANCELLED' || type === 'ALERT_DISMISSED') {
        const id = (data as { id: string })?.id
        setAlerts(old => old.filter(item => item.id !== id)); setPopups(old => old.filter(item => item.id !== id))
      }
      if (type === 'RESYNC' || type.startsWith('NOTIFICATION_') || type.startsWith('ALERT_')) {
        clearTimeout(timer); timer = setTimeout(() => void refresh(), 150)
      }
    })
    const lifecycle = subscribeLifecycle(value => { active = value; if (value) void refresh(); else { generation++; setPopups([]) } })
    const poll = setInterval(() => { setNow(Date.now()); if (realtime.snapshot() !== 'open') void refresh() }, 30000)
    return () => { alive = false; generation++; off(); lifecycle(); clearTimeout(timer); clearTimeout(messageSummaryTimer); clearInterval(poll) }
  }, [account])
  const visible = visibleAlerts(alerts, now)
  const popup = visibleAlerts(popups, now)[0]
  async function dismiss(id: string) {
    await dismissAlert(id)
    setAlerts(old => old.filter(item => item.id !== id)); setPopups(old => old.filter(item => item.id !== id))
  }
  return <Context.Provider value={{ summary, alerts: visible, dismiss }}><LiveFeedback />{children}
    <Sheet visible={Boolean(popup)} onClose={() => setPopups(old => old.filter(item => item.id !== popup?.id))}>
      <Label large>{popup?.title}</Label><Label>{popup?.message}</Label>{!!error && <Label>{error}</Label>}
      {popup?.dismissible && <Button title="Dismiss alert" onPress={() => { setError(''); void dismiss(popup.id).catch(e => setError(errorMessage(e))) }} />}
      <Button title="Close alert" onPress={() => setPopups(old => old.filter(item => item.id !== popup?.id))} />
    </Sheet>
  </Context.Provider>
}
export function LiveAlertBanner() {
  const { alerts } = useLiveUpdates(); const colors = useColors(); const top = alerts[0]
  return top ? <View accessibilityRole={top.severity === 'critical' ? 'alert' : 'summary'} style={{ padding: 10, borderBottomWidth: 1, borderColor: colors.border, gap: 4 }}>
    <Label>{top.title}</Label><Label>{top.message}</Label>
    <Button title={`View alerts (${alerts.length})`} onPress={() => router.push('/notifications?view=alerts')} />
  </View> : null
}
