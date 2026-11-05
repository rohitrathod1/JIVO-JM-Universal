import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api, errorMessage } from '../core/api/client'
import { useSession } from '../core/auth/Session'
import { useIdentity } from '../core/auth/identity'
import { canSubmitToken, tokenPageMode, type TokenCheck } from '../core/auth/identityModel'
import { PasswordField } from './PasswordField'
import { Button, Card, radius, useColors } from '../ui'
import { AuthBackdrop } from './Backdrop'
import { Brand } from './Brand'
import { ThemeToggle } from './ThemeControls'
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
  const muted = { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted } as const
  const hint = { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted, marginTop: -10 } as const
  const link = { fontFamily: 'Inter_500Medium', color: c.brand } as const
  // Reference AuthLayout + TokenPasswordPage: the sign-in page's vivid backdrop and max-w-sm p-7 glass card.
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><AuthBackdrop dark={c.dark} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }}><View style={{ width: '100%', maxWidth: 384 }}><Card style={{ padding: 28, gap: 0, ...(Platform.OS === 'web' ? {} : { backgroundColor: c.dark ? 'rgba(30,41,59,0.90)' : 'rgba(255,255,255,0.84)' }) }}>
    <View style={{ height: 40 }}><Brand /></View>
    <Text accessibilityRole="header" style={{ marginTop: 24, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 20, lineHeight: 28, color: c.text }}>{purpose === 'invite' ? 'Welcome to JIVO JM' : 'Choose a new password'}</Text>
    {mode === 'loading' ? <View style={{ marginTop: 24, alignItems: 'center' }}><ActivityIndicator color={c.brand} /></View> : check?.valid ? <View style={{ marginTop: 16, gap: 16 }}>
      <Text style={muted}>{check.full_name} · <Text style={{ fontFamily: 'Inter_500Medium', color: c.text }}>{check.email}</Text></Text>
      {withJivo ? <>
        <PasswordField label="JIVO password" value={password} onChangeText={setPassword} autoComplete="current-password" autoFocus onSubmitEditing={() => void submit()} />
        <Text style={hint}>The password of your JIVO account, the same for every JIVO app.</Text>
        {!!passwordResetUrl && <Text style={{ ...hint, marginTop: 0 }}>First time, or forgot it?{' '}<Text accessibilityRole="link" onPress={() => openExternal(passwordResetUrl)} style={link}>Set your JIVO password</Text>, then come back to this link.</Text>}
      </> : <>
        <PasswordField label="New password" value={password} onChangeText={setPassword} autoComplete="new-password" autoFocus />
        <Text style={hint}>At least 12 characters. A short sentence works well.</Text>
        <PasswordField label="Repeat password" value={confirm} onChangeText={setConfirm} autoComplete="new-password" onSubmitEditing={() => void submit()} />
        {!!confirm && password !== confirm && <Text style={{ ...hint, color: c.danger }}>The two passwords do not match.</Text>}
      </>}
      {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, backgroundColor: c.dangerSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.control, fontSize: 14, lineHeight: 20 }}>{error}</Text>}
      <Button title={withJivo ? (busy ? 'Signing in…' : 'Sign in') : purpose === 'invite' ? 'Set password and sign in' : 'Save and sign in'} loading={busy} disabled={busy || !canSubmitToken(mode, password, confirm)} onPress={() => void submit()} />
    </View> : <View style={{ marginTop: 16, gap: 16 }}>
      {mode === 'managed-by-jivo' ? <Text style={muted}>Passwords are reset in your JIVO account now.{passwordResetUrl ? ' ' : ''}{!!passwordResetUrl && <Text accessibilityRole="link" onPress={() => openExternal(passwordResetUrl)} style={link}>Reset it there</Text>}</Text>
        : <Text style={muted}>This link is invalid, already used, or expired. Ask a JM administrator for a new one.</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, backgroundColor: c.dangerSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.control, fontSize: 14, lineHeight: 20 }}>{error}</Text>}
      <Link href="/login" style={{ ...link, fontSize: 14, lineHeight: 20 }}>Go to sign in</Link>
    </View>}
  </Card></View></ScrollView></KeyboardAvoidingView><View style={{ position: 'absolute', top: 12, right: 12 }}><ThemeToggle /></View></SafeAreaView>
}
