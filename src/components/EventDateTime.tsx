import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { localDate, parseLocal } from '../modules/messenger/eventForm'
import { Button, Label, useColors } from '../ui'
import { Sheet } from './Sheet'

export function EventDateTime({ label, value, onChange, type, min, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type: 'date' | 'time'; min?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const display = type === 'date' ? parseLocal(value, '12:00')?.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : parseLocal('2026-01-01', value)?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  return <View style={{ gap: 6, flex: 1 }}><Label>{label}</Label><Button title={display ?? `Choose ${type}`} accessibilityLabel={label} variant="secondary" disabled={disabled} onPress={() => setOpen(true)} />
    {open && <Sheet visible onClose={() => setOpen(false)}><Label large>{label}</Label>{type === 'date' ? <Calendar value={value} min={min} onChange={next => { onChange(next); setOpen(false) }} /> : <Time value={value} onChange={next => { onChange(next); setOpen(false) }} />}<Button title="Close picker" variant="ghost" onPress={() => setOpen(false)} /></Sheet>}
  </View>
}
function Calendar({ value, min, onChange }: { value: string; min?: string; onChange: (value: string) => void }) {
  const c = useColors(); const initial = parseLocal(value, '12:00') ?? new Date()
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1))
  const [selecting, setSelecting] = useState<'month' | 'year' | null>(null)
  const offset = month.getDay(); const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); const today = localDate(new Date())
  const changeMonth = (delta: number) => setMonth(date => new Date(date.getFullYear(), date.getMonth() + delta, 1))
  return <View style={{ gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Button title="‹" accessibilityLabel="Previous month" variant="ghost" disabled={!!min && localDate(month).slice(0, 7) <= min.slice(0, 7)} onPress={() => changeMonth(-1)} />
    <View style={{ flex: 1 }}><Button title={month.toLocaleDateString('en-IN', { month: 'long' })} accessibilityLabel="Month" variant="secondary" onPress={() => setSelecting(selecting === 'month' ? null : 'month')} /></View>
    <Button title={String(month.getFullYear())} accessibilityLabel="Year" variant="secondary" onPress={() => setSelecting(selecting === 'year' ? null : 'year')} />
    <Button title="›" accessibilityLabel="Next month" variant="ghost" onPress={() => changeMonth(1)} />
  </View>
    {selecting ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{Array.from({ length: selecting === 'month' ? 12 : 11 }, (_, i) => {
      const date = selecting === 'month' ? new Date(month.getFullYear(), i, 1) : new Date(month.getFullYear() - 5 + i, month.getMonth(), 1)
      return <Button key={i} title={date.toLocaleDateString('en-IN', selecting === 'month' ? { month: 'long' } : { year: 'numeric' })} disabled={!!min && localDate(date).slice(0, 7) < min.slice(0, 7)} variant="secondary" onPress={() => { setMonth(date); setSelecting(null) }} />
    })}</View> : <View>
      <View style={{ flexDirection: 'row' }}>{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <Text key={day} style={{ width: `${100 / 7}%`, textAlign: 'center', color: c.muted, paddingVertical: 6 }}>{day}</Text>)}</View>
      {Array.from({ length: Math.ceil((offset + days) / 7) }, (_, week) => <View key={week} style={{ flexDirection: 'row' }}>{Array.from({ length: 7 }, (_, index) => {
        const day = week * 7 + index - offset + 1; const date = new Date(month.getFullYear(), month.getMonth(), day); const iso = localDate(date)
        return <View key={index} style={{ width: `${100 / 7}%`, padding: 2 }}>{day >= 1 && day <= days && <Pressable accessibilityRole="button" accessibilityLabel={date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} accessibilityState={{ selected: iso === value, disabled: !!min && iso < min }} disabled={!!min && iso < min} onPress={() => onChange(iso)} style={{ minHeight: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: iso === value ? c.primary : iso === today ? c.soft : 'transparent', opacity: min && iso < min ? 0.35 : 1 }}><Text style={{ color: iso === value ? '#fff' : c.text }}>{day}</Text></Pressable>}</View>
      })}</View>)}
    </View>}
    <Button title="Today" variant="ghost" disabled={!!min && today < min} onPress={() => onChange(today)} /><Button title="Clear date" variant="ghost" onPress={() => onChange('')} />
  </View>
}
function Time({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const initial = parseLocal('2026-01-01', value) ?? new Date()
  const [hour, setHour] = useState(initial.getHours() % 12 || 12); const [minute, setMinute] = useState(initial.getMinutes()); const [pm, setPm] = useState(initial.getHours() >= 12)
  const [choosing, setChoosing] = useState<'hour' | 'minute' | null>(null)
  const pad = (number: number) => String(number).padStart(2, '0')
  return <View style={{ gap: 12 }}><Label large>{hour}:{pad(minute)} {pm ? 'PM' : 'AM'}</Label>
    <View style={{ flexDirection: 'row', gap: 8 }}><Button title={pad(hour)} accessibilityLabel="Hour" variant="secondary" onPress={() => setChoosing(choosing === 'hour' ? null : 'hour')} /><Button title={pad(minute)} accessibilityLabel="Minute" variant="secondary" onPress={() => setChoosing(choosing === 'minute' ? null : 'minute')} /><Button title="AM" variant={pm ? 'secondary' : 'primary'} onPress={() => setPm(false)} /><Button title="PM" variant={pm ? 'primary' : 'secondary'} onPress={() => setPm(true)} /></View>
    {choosing && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{Array.from({ length: choosing === 'hour' ? 12 : 60 }, (_, index) => {
      const number = choosing === 'hour' ? index + 1 : index
      return <Button key={number} title={pad(number)} accessibilityLabel={`${choosing} ${pad(number)}`} variant="secondary" onPress={() => { if (choosing === 'hour') setHour(number); else setMinute(number); setChoosing(null) }} />
    })}</View>}
    <Button title="Apply" onPress={() => onChange(`${pad(hour % 12 + (pm ? 12 : 0))}:${pad(minute)}`)} />
  </View>
}
