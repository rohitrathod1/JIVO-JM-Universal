import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api, errorMessage } from '../core/api/client'
import { useSession } from '../core/auth/Session'
import { useIdentity } from '../core/auth/identity'
import { canSubmitToken, tokenPageMode, type TokenCheck } from '../core/auth/identityModel'
import { PasswordField } from './PasswordField'
import { Button, Card, Label, useColors } from '../ui'
const openExternal = (url: string) => { void Linking.openURL(url).catch(() => {}) }
const endpoints = { invite: '/auth/invitations/accept/', reset: '/auth/password/reset/' }
export function TokenPassword({ purpose }: { purpose: 'invite' | 'reset' }) {
  const c = useColors(); const { adopt } = useSession(); const params = useLocalSearchParams<{ token?: string }>()
  const token = typeof params.token === 'string' ? params.token : ''
  const [check, setCheck] = useState<TokenCheck | null>(null)
  const { passwordResetUrl } = useIdentity(); const mode = tokenPageMode(check); const withJivo = mode === 'jivo-sign-in'
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { let active = true; api.get<TokenCheck>(endpoints[purpose], { params: { token } }).then(r => { if (active) setCheck(r.data) }).catch(e => { if (active) { setCheck({ valid: false }); setError(errorMessage(e)) } }); return () => { active = false } }, [purpose, token])
  async function submit() {
    if (busy || !canSubmitToken(mode, password, confirm)) return
    setBusy(true); setError('')
    try { await api.get('/auth/csrf/'); await api.post(endpoints[purpose], { token, password }); await adopt(); router.replace('/') }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false); setPassword(''); setConfirm('') }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}><View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}><Card>
    <Label large>{purpose === 'invite' ? 'Welcome to JIVO JM' : 'Choose a new password'}</Label>
    {mode === 'loading' ? <ActivityIndicator /> : check?.valid ? <><Label>{check.full_name} {check.email}</Label>
      {withJivo ? <>
        <PasswordField label="JIVO password" value={password} onChangeText={setPassword} autoComplete="current-password" onSubmitEditing={() => void submit()} />
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>The password of your JIVO account, the same for every JIVO app.</Text>
        {!!passwordResetUrl && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>First time, or forgot it?{' '}<Text accessibilityRole="link" onPress={() => openExternal(passwordResetUrl)} style={{ fontFamily: 'Inter_600SemiBold', color: c.primary }}>Set your JIVO password</Text>, then come back to this link.</Text>}
      </> : <><Label>Use at least 12 characters. A short sentence works well.</Label>
        <PasswordField label="New password" value={password} onChangeText={setPassword} autoComplete="new-password" />
        <PasswordField label="Repeat password" value={confirm} onChangeText={setConfirm} autoComplete="new-password" />
        {!!confirm && password !== confirm && <Label>The two passwords do not match.</Label>}
      </>}
      <Button title={withJivo ? (busy ? 'Signing in…' : 'Sign in') : purpose === 'invite' ? 'Set password and sign in' : 'Save and sign in'} disabled={busy || !canSubmitToken(mode, password, confirm)} onPress={() => void submit()} />
    </> : mode === 'managed-by-jivo' ? <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>Passwords are reset in your JIVO account now.{passwordResetUrl ? ' ' : ''}{!!passwordResetUrl && <Text accessibilityRole="link" onPress={() => openExternal(passwordResetUrl)} style={{ fontFamily: 'Inter_600SemiBold', color: c.primary }}>Reset it there</Text>}</Text>
    : <Label>This link is invalid, already used, or expired. Ask a JM administrator for a new one.</Label>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}<Link href="/login" style={{ color: c.primary }}>Go to sign in</Link>
  </Card></View></ScrollView></KeyboardAvoidingView></SafeAreaView>
}
