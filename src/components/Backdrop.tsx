import { Image } from 'react-native'
/** Native: the canvas colour is enough (no CSS gradients); the web build draws the reference brand mesh. */
export function AppBackdrop(_props: { dark: boolean }) { return null }
/** Native sign-in and link pages: the pre-rendered vivid brand mesh (no CSS gradients on native). */
export function AuthBackdrop({ dark }: { dark: boolean }) {
  return <Image pointerEvents="none" accessible={false} source={dark ? require('../../assets/brand/auth-backdrop-dark.png') : require('../../assets/brand/auth-backdrop-light.png')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="cover" />
}
