import { useState } from 'react'
import { Switch, View } from 'react-native'
import { generatePassphrase, generatePassword, type SetName } from '../modules/passwords/generator'
import { Button, Card, Field, Label } from '../ui'
import { errorMessage } from '../core/api/client'

export function PasswordGenerator({ onPick, disabled = false }: { onPick: (value: string) => void; disabled?: boolean }) {
  const [length, setLength] = useState('20')
  const [sets, setSets] = useState<SetName[]>(['lower', 'upper', 'digits', 'symbols'])
  const [error, setError] = useState('')
  const valid = /^\d+$/.test(length) && Number(length) >= 16 && Number(length) <= 64
  function generate(passphrase: boolean) {
    setError('')
    try { onPick(passphrase ? generatePassphrase(6) : generatePassword(Number(length), sets)) }
    catch (e) { setError(errorMessage(e)) }
  }
  return <Card><Field label="Password length" value={length} onChangeText={setLength} keyboardType="number-pad" editable={!disabled} maxLength={2} />
    <Label>Choose 16–64 characters.</Label>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{(['lower', 'upper', 'digits', 'symbols'] as SetName[]).map(set => <View key={set} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Switch accessibilityLabel={`Include ${set}`} value={sets.includes(set)} disabled={disabled} onValueChange={value => setSets(current => value ? [...current, set] : current.filter(item => item !== set))} /><Label>{set}</Label></View>)}</View>
    <Button title="Generate password" variant="secondary" disabled={disabled || !valid} onPress={() => generate(false)} />
    <Button title="Passphrase" variant="ghost" disabled={disabled} onPress={() => generate(true)} />
    {!!error && <Label>{error}</Label>}
  </Card>
}
