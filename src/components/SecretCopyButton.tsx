// Reference SecretField copy control: a 36px ghost icon button; the clipboard caution and copy notice sit under the row.
import { Platform, Pressable, Text, View, type PressableStateCallbackType, type ViewStyle } from 'react-native'
import { radius, useColors } from '../ui'
import { Icon } from './Icon'
type PSt = PressableStateCallbackType & { hovered?: boolean }

export function CopyIconButton({ field, disabled, onPress }: { field: string; disabled?: boolean; onPress: () => void }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={`Copy ${field}`} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ hovered }: PSt) => [{ width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? c.hover : 'transparent', opacity: disabled ? 0.5 : 1 }, Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle) : {}]}>
    <Icon name="copy" size={16} color={c.text} />
  </Pressable>
}

export function CopyNote({ children }: { children: string }) {
  const c = useColors()
  return <View><Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{children}</Text></View>
}
