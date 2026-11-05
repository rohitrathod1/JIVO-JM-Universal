import { View } from 'react-native'
import { useColors } from '../ui'

// Matches the web MessageBubblesSkeleton without displaying an empty-chat message.
const bubbles = [
  { own: false, width: 160, height: 36 },
  { own: false, width: 224, height: 56 },
  { own: true, width: 144, height: 36 },
  { own: true, width: 240, height: 36 },
  { own: false, width: 112, height: 36 },
  { own: true, width: 192, height: 56 },
  { own: false, width: 208, height: 36 },
]

export function MessageSkeleton() {
  const c = useColors()
  return <View accessible accessibilityLabel="Loading messages" accessibilityState={{ busy: true }} style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
    <View style={{ alignSelf: 'center', width: 64, height: 20, marginBottom: 4, borderRadius: 10, backgroundColor: c.neutral }} />
    {bubbles.map((bubble, index) => <View key={index} style={{ alignSelf: bubble.own ? 'flex-end' : 'flex-start', width: bubble.width, maxWidth: '75%', height: bubble.height, borderRadius: 16, borderBottomRightRadius: bubble.own ? 6 : 16, borderBottomLeftRadius: bubble.own ? 16 : 6, backgroundColor: c.neutral, opacity: 0.65 }} />)}
  </View>
}
