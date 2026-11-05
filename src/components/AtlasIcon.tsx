import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, Easing, Image, Platform, View } from 'react-native'

/** Artwork exported from assets/atlas/atlas-ai.svg; native layers keep the approved
 * gradient and glow without requiring a new native binary just for SVG support. */
export function AtlasIcon({ size = 48 }: { size?: number }) {
  const [smile] = useState(() => new Animated.Value(0.5))
  const [ripple] = useState(() => new Animated.Value(0))
  useEffect(() => {
    let alive = true
    let reduced = true
    let foreground = AppState.currentState === 'active'
    let animation: Animated.CompositeAnimation | undefined
    const timing = (value: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.ease)) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver: Platform.OS !== 'web', isInteraction: false })
    const sync = () => {
      animation?.stop()
      smile.setValue(0.5); ripple.setValue(0)
      if (!alive || reduced || !foreground) return
      smile.setValue(0)
      animation = Animated.parallel([
        Animated.loop(Animated.sequence([timing(smile, 1, 500), timing(smile, 0, 500)])),
        Animated.loop(timing(ripple, 1, 3600, Easing.linear)),
      ])
      animation.start()
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) { reduced = value; sync() } }).catch(() => {})
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduced = value; sync() })
    const state = AppState.addEventListener('change', value => { foreground = value === 'active'; sync() })
    return () => { alive = false; animation?.stop(); motion.remove(); state.remove() }
  }, [smile, ripple])
  const unit = size / 256
  const first = Animated.modulo(ripple, 1)
  const second = Animated.modulo(Animated.add(ripple, 0.5), 1)
  return <View accessible={false} pointerEvents="none" style={{ width: size, height: size }}>
    {[first, second].map((phase, index) => <Animated.View key={index} style={{ position: 'absolute', left: 52 * unit, top: 52 * unit, width: 152 * unit, height: 152 * unit, borderRadius: 76 * unit, borderWidth: 1.5 * unit, borderColor: '#8295f9', opacity: phase.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.32, 0] }), transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 112 / 76] }) }] }} />)}
    <Image accessible={false} source={require('../../assets/atlas/orbit-eyes.png')} style={{ position: 'absolute', width: size, height: size }} />
    <Animated.Image accessible={false} source={require('../../assets/atlas/smile.png')} style={{ position: 'absolute', left: 98 * unit, top: 136 * unit, width: 60 * unit, height: 24 * unit, transformOrigin: 'center top', transform: [{ scaleX: smile.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) }, { scaleY: smile.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1.12] }) }] }} />
  </View>
}
