import { Image, Text, View } from 'react-native'
import { useColors } from '../ui'
import { clockTime, dayLabel, sameDay } from '../modules/messenger/lib/text'
import type { DeliveryStatus } from '../modules/messenger/api'
import { Icon } from './Icon'

export type MessageDelivery = DeliveryStatus | 'sending' | 'queued' | 'failed' | null
export function MessageTicks({ status }: { status: MessageDelivery }) {
  const c = useColors()
  if (!status) return null
  const label = status === 'sending' ? 'Sending' : status === 'queued' ? 'Waiting for the network' : status === 'failed' ? 'Not sent' : status[0].toUpperCase() + status.slice(1)
  return <View accessible accessibilityRole="image" accessibilityLabel={label}>
    {status === 'sending' || status === 'queued' || status === 'failed' ? <Icon name={status === 'failed' ? 'alert' : 'clock'} size={14} color={status === 'failed' ? c.danger : c.muted} /> : <Image accessible={false} source={status === 'sent' ? require('../../assets/icons/ReceiptSent.png') : require('../../assets/icons/ReceiptDouble.png')} style={{ width: 18, height: 11, tintColor: status === 'read' ? '#0ea5e9' : c.muted }} />}
  </View>
}
export function MessageMeta({ createdAt, edited = false, status = null }: { createdAt: string; edited?: boolean; status?: MessageDelivery }) {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 6, paddingTop: 2 }}>
    {edited && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: c.muted }}>edited</Text>}
    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, fontVariant: ['tabular-nums'], color: c.muted }}>{clockTime(createdAt)}</Text>
    <MessageTicks status={status} />
  </View>
}
/** Put before the day's first message, outside its left/right bubble alignment. */
export function MessageDay({ createdAt, previousAt }: { createdAt: string; previousAt?: string }) {
  const c = useColors()
  if (previousAt && sameDay(createdAt, previousAt)) return null
  return <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 12 }}><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.panel }}>{dayLabel(createdAt)}</Text></View>
}
