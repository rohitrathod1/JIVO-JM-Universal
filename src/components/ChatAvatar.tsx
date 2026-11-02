import { Image, Text, View } from 'react-native'
import { useState } from 'react'
import { useColors } from '../ui'
import { Icon } from './Icon'
const avatarColors = ['#16A34A', '#0D9488', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#CA8A04', '#475569']
function colorFor(seed: string) { let hash = 0; for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; return avatarColors[hash % avatarColors.length] }
export function ChatAvatar({ name, seed, uri, group = false, size = 48 }: { name: string; seed?: string; uri?: string | null; group?: boolean; size?: number }) {
  const c = useColors(); const [failed, setFailed] = useState<string | null>(null)
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: group ? c.soft : colorFor(seed ?? name), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {uri && failed !== uri ? <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setFailed(uri)} /> : group ? <Icon name="users" size={22} color={c.brand} /> : <Text style={{ color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: size * 0.38 }}>{name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</Text>}
  </View>
}
