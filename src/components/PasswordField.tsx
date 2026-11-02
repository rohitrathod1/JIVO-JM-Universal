import { useState } from 'react'
import { Pressable, View, type TextInputProps } from 'react-native'
import { Field } from '../ui'
import { Icon } from './Icon'

export function PasswordField({ style, ...props }: Omit<TextInputProps, 'secureTextEntry'> & { label: string; compact?: boolean }) {
  const [visible, setVisible] = useState(false)
  return <View><Field {...props} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false} style={[{ paddingRight: 48 }, style]} />
    <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} accessibilityState={{ selected: visible, disabled: props.editable === false }} disabled={props.editable === false} onPress={() => setVisible(value => !value)} style={{ position: 'absolute', right: 0, bottom: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}><Icon name={visible ? 'eyeOff' : 'eye'} size={18} /></Pressable>
  </View>
}
