import { useState } from 'react'
import { Modal, Platform, Pressable, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import type { TimeFieldProps } from './TimeField'
import { useColors } from '../ui'
import { Icon } from './Icon'
export function TimeField({ label, value, disabled, onChange }: TimeFieldProps) {
  const c = useColors(); const [open, setOpen] = useState(false)
  const date = new Date(); const [h, m] = (value || '22:00').split(':').map(Number); date.setHours(h, m, 0, 0)
  return <View><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => setOpen(true)} style={{ minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.panel }}><Icon name="clock" size={18} color={c.muted} /><Text style={{ color: c.text, fontSize: 16 }}>{value || '--:--'}</Text></Pressable>
    {open && (Platform.OS === 'ios' ? <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}><View style={{ backgroundColor: c.panel, padding: 20, paddingBottom: 36 }}><Text style={{ color: c.text, fontSize: 16 }}>{label} ? India time</Text><DateTimePicker value={date} mode="time" is24Hour display="spinner" themeVariant={c.dark ? 'dark' : 'light'} onValueChange={(_event, selected) => onChange(String(selected.getHours()).padStart(2, '0') + ':' + String(selected.getMinutes()).padStart(2, '0'))} /><Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ padding: 12, alignItems: 'flex-end' }}><Text style={{ color: c.brand }}>Done</Text></Pressable></View></View></Modal>
      : <DateTimePicker value={date} mode="time" is24Hour display="default" onDismiss={() => setOpen(false)} onValueChange={(_event, selected) => { setOpen(false); onChange(String(selected.getHours()).padStart(2, '0') + ':' + String(selected.getMinutes()).padStart(2, '0')) }} />)}
  </View>
}
