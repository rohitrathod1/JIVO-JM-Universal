import { Image, View } from 'react-native'
import { useColors } from '../ui'

export function Brand({ compact = false }: { compact?: boolean }) {
  const c = useColors()
  return <View accessibilityLabel="JIVO JM" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Image source={require('../../assets/brand/jm-mark.png')} style={{ width: compact ? 32 : 34, height: compact ? 32 : 34 }} resizeMode="contain" />
    {!compact && <Image source={c.dark ? require('../../assets/brand/jm-wordmark-light.png') : require('../../assets/brand/jm-wordmark-dark.png')} style={{ width: 30, height: 18 }} resizeMode="contain" />}
  </View>
}
export function AuthBackdrop() {
  const c = useColors()
  return <Image pointerEvents="none" accessible={false} source={c.dark ? require('../../assets/brand/auth-backdrop-dark.png') : require('../../assets/brand/auth-backdrop-light.png')} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
}
