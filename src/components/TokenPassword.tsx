import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api, errorMessage } from '../core/api/client'
import { useSession } from '../core/auth/Session'
import { Button, Card, Field, Label, useColors } from '../ui'
const endpoints = { invite: '/auth/invitations/accept/', reset: '/auth/password/reset/' }
export function TokenPassword({ purpose }: { purpose: 'invite' | 'reset' }) {
  const c = useColors(); const { adopt } = useSession(); const params = useLocalSearchParams<{ token?: string }>()
  const token = typeof params.token === 'string' ? params.token : ''
  const [check, setCheck] = useState<{ valid: boolean; email?: string; full_name?: string } | null>(null)
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { let active = true; api.get(endpoints[purpose], { params: { token } }).then(r => { if (active) setCheck(r.data) }).catch(e => { if (active) { setCheck({ valid: false }); setError(errorMessage(e)) } }); return () => { active = false } }, [purpose, token])
  async function submit() {
    if (busy || !check?.valid || !password || password !== confirm) return
    setBusy(true); setError('')
    try { await api.get('/auth/csrf/'); await api.post(endpoints[purpose], { token, password }); await adopt(); router.replace('/') }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false); setPassword(''); setConfirm('') }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}><View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}><Card>
    <Label large>{purpose === 'invite' ? 'Welcome to JIVO JM' : 'Choose a new password'}</Label>
    {!check ? <ActivityIndicator /> : check.valid ? <><Label>{check.full_name} {check.email}</Label><Label>Use at least 12 characters. A short sentence works well.</Label>
      <Field label="New password" secureTextEntry value={password} onChangeText={setPassword} autoComplete="new-password" />
      <Field label="Repeat password" secureTextEntry value={confirm} onChangeText={setConfirm} autoComplete="new-password" />
      {!!confirm && password !== confirm && <Label>The two passwords do not match.</Label>}
      <Button title={purpose === 'invite' ? 'Set password and sign in' : 'Save and sign in'} disabled={busy || !password || password !== confirm} onPress={() => void submit()} />
    </> : <Label>This link is invalid, already used, or expired. Ask a JM administrator for a new one.</Label>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}<Link href="/login" style={{ color: c.primary }}>Go to sign in</Link>
  </Card></View></ScrollView></KeyboardAvoidingView></SafeAreaView>
}
