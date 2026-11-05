import { useState, type ComponentProps } from 'react'
import { Pressable } from 'react-native'
import { Field, useColors } from '../ui'
import { Icon } from './Icon'

export function PasswordField({ style, ...props }: Omit<ComponentProps<typeof Field>, 'secureTextEntry' | 'trailing'>) {
  const c = useColors()
  const [visible, setVisible] = useState(false)
  return <Field {...props} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false} style={style} trailing={
    <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} accessibilityState={{ selected: visible, disabled: props.editable === false }} disabled={props.editable === false} onPress={() => setVisible(value => !value)} style={({ pressed }) => ({ backgroundColor: pressed ? c.soft : 'transparent', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 })}><Icon name={visible ? 'eyeOff' : 'eye'} size={18} /></Pressable>
  } />
}
