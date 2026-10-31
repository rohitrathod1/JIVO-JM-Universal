import { useEffect, useState } from 'react'
import { ScrollView, View, Text } from 'react-native'
import { Redirect, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSession } from '../core/auth/Session'
import { api, errorMessage, origin } from '../core/api/client'
import { passkeysSupported, signInWithPasskey } from '../core/auth/security'
import { Button, Card, Field, Label, useColors } from '../ui'
export default function Login() {
  const c = useColors(); const { me, login, adopt, status, error: sessionError } = useSession()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [token, setToken] = useState(''); const [code, setCode] = useState('')
  const [methods, setMethods] = useState<string[]>([]); const [offerPasskey, setOfferPasskey] = useState(false)
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!origin) return
    let active = true
    api.get<{ passkey_sign_in: boolean }>('/auth/options/').then(r => { if (active) setOfferPasskey(r.data.passkey_sign_in) }).catch(() => {})
    return () => { active = false }
  }, [])
  if (me) return <Redirect href="/messenger" />
  async function submit() {
    setBusy(true); setError('')
    try {
      if (token) { await api.post('/auth/login/verify/', { mfa_token: token, method: 'recovery_code', code }); setCode(''); await adopt() }
      else {
        const result = await login(email.trim(), password)
        setPassword('')
        if (result.status === 'mfa_required') {
          setToken(result.mfa_token); setMethods(result.methods)
          if (!result.methods.includes('recovery_code') && !passkeysSupported()) setError('This account requires a passkey. Native passkey integration needs platform association; verification cannot be skipped.')
        }
      }
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function passkey() {
    setBusy(true); setError('')
    try { await signInWithPasskey(token || undefined); await adopt() }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
    <View style={{ width: '100%', maxWidth: 440, gap: 24 }}>
      <Text style={{ fontSize: 44, fontWeight: '900', color: c.primary }}>JIVO<Text style={{ color: '#E8A317' }}>.</Text></Text>
      <Label large>Welcome to JM</Label><Label>Your team. Your conversations. Together.</Label>
      <Card><Label large>{token ? 'Verify your identity' : 'Sign in'}</Label>
        {token ? methods.includes('recovery_code') && <Field label="Recovery code" value={code} onChangeText={setCode} autoCapitalize="none" secureTextEntry /> : <>
          <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={() => void submit()} />
        </>}
        {!!(error || sessionError) && <Text accessibilityRole="alert" style={{ color: '#b45309' }}>{error || sessionError}</Text>}
        {(!token || methods.includes('recovery_code')) && <Button title={busy ? 'Signing in…' : 'Continue'} onPress={() => void submit()} disabled={busy || (status === 'loading' || status === 'signing-out') || (token ? !code : !email || !password)} />}
        {passkeysSupported() && (token ? methods.includes('passkey') : offerPasskey) && <Button title="Sign in with a passkey" onPress={() => void passkey()} disabled={busy || (status === 'loading' || status === 'signing-out')} />}
        {!!token && <Button title="Back to sign in" disabled={busy} onPress={() => { setToken(''); setMethods([]); setCode(''); setError('') }} />}
      </Card>
      <Link href="/preview" style={{ color: c.primary, padding: 12 }}>Preview responsive workspace</Link>
    </View>
  </ScrollView></SafeAreaView>
}

