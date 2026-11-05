import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as ScreenCapture from 'expo-screen-capture'
import { ScreenCaptureGuard, type CaptureLevel } from './screenCaptureGuard'

const KEY = 'jm-sensitive'
const guard = new ScreenCaptureGuard({
  prevent: () => ScreenCapture.preventScreenCaptureAsync(KEY),
  allow: () => ScreenCapture.allowScreenCaptureAsync(KEY),
  protectSwitcher: () => Platform.OS === 'ios' ? ScreenCapture.enableAppSwitcherProtectionAsync(1) : Promise.resolve(),
  unprotectSwitcher: () => Platform.OS === 'ios' ? ScreenCapture.disableAppSwitcherProtectionAsync() : Promise.resolve(),
})

/** Keeps screen capture (or only the iOS app-switcher snapshot) protected while `level` is set. */
export function useScreenCaptureGuard(level: CaptureLevel | false) {
  useEffect(() => level ? guard.acquire(level) : undefined, [level])
}
