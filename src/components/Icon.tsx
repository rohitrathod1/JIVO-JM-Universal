import { Image, Pressable } from 'react-native'
import { useColors } from '../ui'

// Original frontend Lucide vectors rasterized at 3x for native portability.
const icons = {
  chat: require('../../assets/icons/MessageSquare.png'), key: require('../../assets/icons/KeyRound.png'),
  bell: require('../../assets/icons/Bell.png'), user: require('../../assets/icons/UserRound.png'),
  shield: require('../../assets/icons/Shield.png'), logout: require('../../assets/icons/LogOut.png'),
  down: require('../../assets/icons/ChevronDown.png'), menu: require('../../assets/icons/EllipsisVertical.png'),
  back: require('../../assets/icons/ArrowLeft.png'), plus: require('../../assets/icons/Plus.png'),
  send: require('../../assets/icons/Send.png'), users: require('../../assets/icons/Users.png'),
  pin: require('../../assets/icons/Pin.png'), search: require('../../assets/icons/Search.png'),
  moon: require('../../assets/icons/Moon.png'), sun: require('../../assets/icons/Sun.png'), system: require('../../assets/icons/Monitor.png'),
  eye: require('../../assets/icons/Eye.png'), eyeOff: require('../../assets/icons/EyeOff.png'),
  clock: require('../../assets/icons/Clock3.png'), alert: require('../../assets/icons/AlertCircle.png'),
  check: require('../../assets/icons/Check.png'), checks: require('../../assets/icons/CheckCheck.png'),
  lock: require('../../assets/icons/Lock.png'), unlock: require('../../assets/icons/LockOpen.png'), home: require('../../assets/icons/Home.png'),
} as const
export type IconName = keyof typeof icons
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors()
  return <Image accessible={false} source={icons[name]} style={{ width: size, height: size, tintColor: color ?? c.muted }} />
}
export function IconButton({ name, label, onPress, disabled = false, primary = false }: { name: IconName; label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: primary ? c.primary : pressed ? c.neutral : 'transparent', opacity: disabled ? 0.45 : 1 })}>
    <Icon name={name} color={primary ? '#ffffff' : c.muted} />
  </Pressable>
}
