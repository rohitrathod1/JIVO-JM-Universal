import { useEffect, useState } from 'react'
import { ScrollView, View, Text } from 'react-native'
import { Redirect, Link, useLocalSearchParams, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSession } from '../core/auth/Session'
import { api, errorMessage, origin } from '../core/api/client'
import { passkeysSupported, signInWithPasskey } from '../core/auth/security'
import { Button, Card, Field, Label, useColors } from '../ui'
import { AuthBackdrop, Brand } from '../components/Brand'
import { ThemeToggle } from '../components/ThemeControls'
import { PasswordField } from '../components/PasswordField'
import { safeNext } from '../shared/authNavigation'
export default function Login() {
  const c = useColors(); const { me, login, adopt, status, error: sessionError } = useSession()
  const { next } = useLocalSearchParams<{ next?: string }>()
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
  if (me) return <Redirect href={safeNext(next) as Href} />
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
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><AuthBackdrop /><View style={{ alignSelf: 'flex-end', paddingTop: 4, paddingRight: 12 }}><ThemeToggle /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16, paddingBottom: 60 }}>
    <View style={{ width: '100%', maxWidth: 384 }}>
      <Card style={{ padding: 28, gap: 16, backgroundColor: c.dark ? 'rgba(30,41,59,0.90)' : 'rgba(255,255,255,0.84)' }}>
        <Brand />
        <View style={{ marginTop: 8, marginBottom: 8, gap: 4 }}><Label large>{token ? 'Two-step verification' : 'Sign in'}</Label><Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20 }}>{token ? `Confirm it’s you, ${email.trim()}.` : 'Messenger and Passwords for JIVO.'}</Text></View>
        {token ? methods.includes('recovery_code') && <Field label="Recovery code" value={code} onChangeText={setCode} autoCapitalize="none" secureTextEntry /> : <>
          <Field label="Email" accessibilityLabel="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <PasswordField label="Password" value={password} onChangeText={setPassword} autoComplete="current-password" onSubmitEditing={() => void submit()} />
        </>}
        {!!(error || sessionError) && <Text accessibilityRole="alert" style={{ color: c.danger, backgroundColor: c.dangerSoft, padding: 10, borderRadius: 10, fontSize: 14 }}>{error || sessionError}</Text>}
        {(!token || methods.includes('recovery_code')) && <Button title={busy ? 'Signing in…' : 'Continue'} onPress={() => void submit()} disabled={busy || (status === 'loading' || status === 'signing-out') || (token ? !code : !email || !password)} />}
        {passkeysSupported() && (token ? methods.includes('passkey') : offerPasskey) && <Button variant="secondary" title="Sign in with a passkey" onPress={() => void passkey()} disabled={busy || (status === 'loading' || status === 'signing-out')} />}
        {!!token && <Button variant="ghost" title="Back to sign in" disabled={busy} onPress={() => { setToken(''); setMethods([]); setCode(''); setError('') }} />}
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted, marginTop: 4 }}>Forgot your password or new here? Ask a JM administrator for a link.</Text>
      </Card>
      <Link href="/preview" style={{ color: c.primary, padding: 12, textAlign: 'center', fontSize: 12 }}>Preview responsive workspace</Link>
    </View>
  </ScrollView></SafeAreaView>
}

