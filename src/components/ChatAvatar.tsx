import { Image, Text, View } from 'react-native'
import { useState } from 'react'
import { useColors } from '../ui'
import { Icon } from './Icon'
// Reference hues darkened to the 600/700 step so white initials reach WCAG AA 4.5:1 (DEF-006).
export const avatarColors = ['#15803D', '#0F766E', '#2563EB', '#7C3AED', '#BE185D', '#C2410C', '#A16207', '#475569']
/** Use the person's name, excluding the self-chat display label. */
export function initials(name: string) {
  const parts = name.replace(/\s*\(you\)\s*$/i, '').trim().split(/\s+/)
    .map(part => part.match(/\p{L}|\p{N}/u)?.[0]).filter((part): part is string => !!part)
  return parts.length ? (parts[0] + (parts.length > 1 ? parts[parts.length - 1] : '')).toUpperCase() : '?'
}
function colorFor(seed: string) { let hash = 0; for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; return avatarColors[hash % avatarColors.length] }
export function ChatAvatar({ name, seed, uri, group = false, size = 48 }: { name: string; seed?: string; uri?: string | null; group?: boolean; size?: number }) {
  const c = useColors(); const [failed, setFailed] = useState<string | null>(null)
  return <View style={{ width: size, height: size, flexShrink: 0, borderRadius: size / 2, backgroundColor: group && !(uri && failed !== uri) ? c.successSoft : colorFor(seed ?? name), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {uri && failed !== uri ? <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setFailed(uri)} /> : group ? <Icon name="users" size={20} color={c.brand} /> : <Text style={{ color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: size * 0.38 }}>{initials(name)}</Text>}
  </View>
}
