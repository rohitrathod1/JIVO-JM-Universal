import { VoiceRecorder } from './VoiceRecorder'
import type { PickedFile } from '../modules/messenger/media/model'
import { QUICK_REACTIONS, MORE_REACTIONS } from '../modules/messenger/lib/text'
import { enterSends } from '../modules/messenger/composer'
import { Image, Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native'
import { useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { Field, glass, useColors } from '../ui'
import { Icon, type IconName } from './Icon'

const web = Platform.OS === 'web'
const send = require('../../assets/icons/SendHorizontal.png')
/** Reference Composer: Enter sends (Shift+Enter adds a line) unless the pointer is coarse (touch keyboards keep Enter as newline). */
const coarsePointer = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

/** Reference Composer: 40px round + / mic / send buttons around a 40px, 20px-radius message box. */
function RoundButton({ label, onPress, disabled = false, primary = false, active = false, expanded, children }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; active?: boolean; expanded?: boolean; children: ReactNode }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded }} disabled={disabled} onPress={onPress} hitSlop={4}
    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: primary ? (pressed || hovered ? c.primaryHover : c.primary) : pressed || hovered ? c.hover : 'transparent', opacity: disabled ? 0.5 : 1, transform: active ? [{ rotate: '45deg' }] : [] })}>
    {children}
  </Pressable>
}

/** Presentation only: callers retain drafts, mentions, uploads, permissions and send durability. */
export function ChatComposer({ inputProps, onSend, sendLabel = 'Send message', sendDisabled, disabled = false, onTools, attach, onVoice }: {
  inputProps: TextInputProps
  onSend: () => void
  sendLabel?: string
  sendDisabled: boolean
  disabled?: boolean
  /** The + button (attach and message tools); omitted while editing, as in the reference. Ignored when `attach` is given. */
  onTools?: () => void
  /** Reference AttachMenu: when given, + opens Document / Photos & videos / Camera / Location / Contact / Poll / Event. */
  attach?: AttachActions
  /** When given, the microphone replaces Send while nothing is typed or attached. */
  onVoice?: (file: PickedFile) => Promise<void>
}) {
  const c = useColors()
  const plus = useRef<ComponentRef<typeof View>>(null); const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const caret = useRef<{ start: number; end: number } | null>(null)
  const [emojis, setEmojis] = useState(false)
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const { height: screenHeight } = useWindowDimensions()
  const showMic = Boolean(onVoice) && sendDisabled
  const openAttach = () => plus.current?.measureInWindow((x: number, y: number) => setAnchor({ x, y }))
  return <View><View style={[glass(c, 1), { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 }]}>
    <View ref={plus} collapsable={false} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 26, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingHorizontal: 4, paddingVertical: 2 }}>
      <RoundButton label={emojis ? "Show keyboard" : "Emoji"} disabled={disabled} expanded={emojis} onPress={() => { if (emojis) { setEmojis(false); input.current?.focus() } else { Keyboard.dismiss(); setEmojis(true) } }}><Icon name={emojis ? "keyboard" : "smile"} size={24} color={c.muted} /></RoundButton>
      <View style={{ flex: 1, minWidth: 0 }}><Field inset={false} {...inputProps} ref={input} onFocus={event => { setEmojis(false); inputProps.onFocus?.(event) }} onSelectionChange={event => { caret.current = event.nativeEvent.selection; inputProps.onSelectionChange?.(event) }} onKeyPress={event => { inputProps.onKeyPress?.(event); if (!web) return; const key = event.nativeEvent as unknown as { key: string; shiftKey?: boolean; isComposing?: boolean }; if (!enterSends(key, coarsePointer())) return; (event as unknown as { preventDefault?: () => void }).preventDefault?.(); if (!disabled && !sendDisabled) onSend() }} compact label="Message" placeholder={inputProps.placeholder ?? 'Message'} multiline numberOfLines={web ? 1 : undefined} editable={!disabled && inputProps.editable !== false} style={[{ borderWidth: 0, borderRadius: 20, boxShadow: 'none', maxHeight: 160, minHeight: 40, paddingLeft: 8, paddingRight: 8, paddingTop: 10, paddingBottom: 10, fontSize: 15, lineHeight: 22, backgroundColor: 'transparent' }, inputProps.style]} /></View>
      {attach ? <View><RoundButton label="Attach" disabled={disabled} expanded={!!anchor} onPress={openAttach}><Icon name="paperclip" size={22} color={anchor ? c.brand : c.muted} /></RoundButton></View>
        : onTools && <RoundButton label="Message tools" disabled={disabled} onPress={onTools}><Icon name="paperclip" size={22} color={c.muted} /></RoundButton>}
      {attach && sendDisabled && <RoundButton label="Camera" disabled={disabled || !attach.canSendFile} onPress={attach.onCamera}><Icon name="camera" size={23} color={c.muted} /></RoundButton>}
    </View>
    {showMic
      ? <VoiceRecorder disabled={disabled} onSend={onVoice!} />
      : <RoundButton label={sendLabel} primary disabled={disabled || sendDisabled} onPress={onSend}><Image accessible={false} source={send} style={{ width: 20, height: 20, tintColor: '#ffffff' }} /></RoundButton>}
    </View>
    {emojis && <ScrollView accessibilityLabel="Emoji picker" keyboardShouldPersistTaps="always" style={{ height: Math.min(280, screenHeight * 0.36), flexGrow: 0, backgroundColor: c.panel }} contentContainerStyle={{ padding: 12, flexDirection: 'row', flexWrap: 'wrap' }}>{[...QUICK_REACTIONS, ...MORE_REACTIONS].map(emoji => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`} disabled={disabled} onPress={() => {
      const text = inputProps.value ?? ''
      const start = Math.min(text.length, caret.current?.start ?? inputProps.selection?.start ?? text.length)
      const end = Math.min(text.length, caret.current?.end ?? inputProps.selection?.end ?? start)
      caret.current = { start: start + emoji.length, end: start + emoji.length }
      inputProps.onChangeText?.(text.slice(0, start) + emoji + text.slice(end))
    }} style={{ width: '12.5%', minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26 }}>{emoji}</Text></Pressable>)}</ScrollView>}
    {attach && anchor && <AttachMenu anchor={anchor} actions={attach} onClose={() => setAnchor(null)} />}
  </View>
}

export type AttachActions = {
  canSendFile: boolean
  onDocument: () => void
  onMedia: () => void
  onCamera: () => void
  onLocation: () => void
  onContact: () => void
  onPoll: () => void
  onEvent: () => void
}
const attachItems: { key: keyof Omit<AttachActions, 'canSendFile'>; label: string; icon: IconName; tone: string; file: boolean }[] = [
  { key: 'onDocument', label: 'Document', icon: 'fileText', tone: '#8b5cf6', file: true },
  { key: 'onMedia', label: 'Photos & videos', icon: 'image', tone: '#0ea5e9', file: true },
  { key: 'onCamera', label: 'Camera', icon: 'camera', tone: '#f43f5e', file: true },
  { key: 'onLocation', label: 'Location', icon: 'mapPin', tone: '#059669', file: false },
  { key: 'onContact', label: 'Contact', icon: 'user', tone: '#0d9488', file: false },
  { key: 'onPoll', label: 'Poll', icon: 'barChart3', tone: '#f59e0b', file: false },
  { key: 'onEvent', label: 'Event', icon: 'calendarDays', tone: '#ec4899', file: false },
]

/** Reference AttachMenu: a 224px glass card 8px above the + button, 36px coloured round icons, 15px labels. */
export function AttachMenu({ anchor, actions, onClose }: { anchor: { x: number; y: number }; actions: AttachActions; onClose: () => void }) {
  const c = useColors(); const { width, height } = useWindowDimensions()
  const left = Math.max(8, Math.min(anchor.x, width - 224 - 8))
  return <Modal transparent visible onRequestClose={onClose} animationType="none">
    <Pressable accessibilityLabel="Close attach menu" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(web ? { cursor: 'default' } : {}) } as object} />
    <View accessibilityRole="menu" accessibilityLabel="Attach" style={[glass(c, 4), { position: 'absolute', left, bottom: Math.max(8, height - anchor.y + 8), width: 224, borderWidth: 1, borderRadius: 12, padding: 6 }]}>
      {attachItems.map(item => { const disabled = item.file && !actions.canSendFile
        return <Pressable key={item.key} accessibilityRole="menuitem" accessibilityLabel={item.label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { onClose(); actions[item.key]() }}
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, opacity: disabled ? 0.5 : 1, backgroundColor: (hovered || pressed) && !disabled ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }, web ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as object) : null]}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: item.tone }}><Icon name={item.icon} size={20} color="#ffffff" /></View>
          <Text style={{ color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 }}>{item.label}</Text>
        </Pressable> })}
    </View>
  </Modal>
}
