import { View, type TextInputProps } from 'react-native'
import type { ReactNode } from 'react'
import { Field, useColors } from '../ui'
import { IconButton } from './Icon'

/** Presentation only: callers retain drafts, mentions, uploads, permissions and send durability. */
export function ChatComposer({ inputProps, onSend, sendLabel = 'Send message', sendDisabled, disabled = false, accessories }: {
  inputProps: TextInputProps
  onSend: () => void
  sendLabel?: string
  sendDisabled: boolean
  disabled?: boolean
  accessories?: ReactNode
}) {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingVertical: 4, backgroundColor: c.shell }}>
    {accessories}
    <View style={{ flex: 1, minWidth: 0 }}><Field {...inputProps} compact label="Message" placeholder={inputProps.placeholder ?? 'Message'} multiline editable={!disabled && inputProps.editable !== false} style={[{ borderRadius: 24, maxHeight: 120, minHeight: 44, paddingHorizontal: 16, paddingVertical: 11 }, inputProps.style]} /></View>
    <IconButton name="send" label={sendLabel} primary disabled={disabled || sendDisabled} onPress={onSend} />
  </View>
}
