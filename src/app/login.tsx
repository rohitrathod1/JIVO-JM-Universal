import { useRef, useState, type ComponentRef } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, Text, type TextInput } from 'react-native'
import { Redirect, Link, useLocalSearchParams, type Href } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSession } from '../core/auth/Session'
import { api, errorMessage } from '../core/api/client'
import { useIdentity } from '../core/auth/identity'
import { passkeysSupported, signInWithPasskey } from '../core/auth/security'
import { Button, Card, Field, radius, useColors } from '../ui'
import { Brand } from '../components/Brand'
import { AuthBackdrop } from '../components/Backdrop'
import { ThemeToggle } from '../components/ThemeControls'
import { PasswordField } from '../components/PasswordField'
import { IconTextButton } from '../components/AdminUi'
import { Icon } from '../components/Icon'
import { safeNext } from '../shared/authNavigation'
export default function Login() {
  const c = useColors(); const { me, login, adopt, status, error: sessionError } = useSession()
  const { next } = useLocalSearchParams<{ next?: string }>()
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null)
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [token, setToken] = useState(''); const [code, setCode] = useState('')
  const [methods, setMethods] = useState<string[]>([])
  // Reference: with a passkey on the account the recovery-code form stays behind "Use a recovery code".
  const [useRecovery, setUseRecovery] = useState(false)
  // One read of GET /auth/options/: passkey sign-in, and whether accounts live in Jivo Auth (FE-032).
  const { passkeySignIn: offerPasskey, jivo } = useIdentity()
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  if (me) return <Redirect href={safeNext(next) as Href} />
  async function submit() {
    if (busy || status === 'loading' || status === 'signing-out' || (token ? !code.trim() : !email.trim() || !password)) return
    setBusy(true); setError('')
    try {
      if (token) { await api.post('/auth/login/verify/', { mfa_token: token, method: 'recovery_code', code }); setCode(''); await adopt() }
      else {
        const result = await login(email.trim(), password)
        setPassword('')
        if (result.status === 'mfa_required') {
          setToken(result.mfa_token); setMethods(result.methods); setUseRecovery(!result.methods.includes('passkey') || !passkeysSupported())
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
  const blocked = busy || status === 'loading' || status === 'signing-out'
  const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null
  // Header participates in safe-area layout so its controls stay below the status bar.
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><AuthBackdrop dark={c.dark} /><View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 }}><ThemeToggle prominent /></View><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
    <View style={{ width: '100%', maxWidth: 420 }}>
      <Card style={{ padding: 24, gap: 0, borderRadius: 20, ...(Platform.OS === 'web' ? {} : { backgroundColor: c.dark ? 'rgba(30,41,59,0.90)' : 'rgba(255,255,255,0.84)' }) }}>
        <View style={{ height: 40 }}><Brand /></View>
        <Text accessibilityRole="header" style={{ marginTop: 24, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 20, lineHeight: 28, color: c.text }}>{token ? 'Two-step verification' : 'Sign in'}</Text>
        <Text style={{ marginTop: 4, fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20 }}>{token ? `Confirm it’s you, ${email.trim()}.` : 'Messenger and Passwords for JIVO.'}</Text>
        {token ? <View style={{ marginTop: 24, gap: 16 }}>
          {methods.includes('passkey') && passkeysSupported() && <IconTextButton icon="fingerprint" title={busy ? 'Verifying…' : 'Use your passkey'} onPress={() => void passkey()} disabled={blocked} />}
          {methods.includes('recovery_code') && useRecovery && <>
            <PasswordField label="Recovery code" hint="One of the codes you saved when you added your passkey. Each works once." placeholder="abcd-efgh-jkmn" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} autoFocus onSubmitEditing={() => void submit()} />
            {!!(error || sessionError) && <Text accessibilityRole="alert" style={{ color: c.danger, backgroundColor: c.dangerSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.control, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' }}>{error || sessionError}</Text>}
            <Button variant={methods.includes('passkey') && passkeysSupported() ? 'secondary' : 'primary'} title={busy ? 'Verifying…' : 'Verify'} onPress={() => void submit()} disabled={blocked || !code} />
          </>}
          {!(methods.includes('recovery_code') && useRecovery) && !!(error || sessionError) && <Text accessibilityRole="alert" style={{ color: c.danger, backgroundColor: c.dangerSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.control, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' }}>{error || sessionError}</Text>}
          <View style={{ gap: 4 }}>
            {methods.includes('recovery_code') && !useRecovery && <Pressable accessibilityRole="button" accessibilityLabel="Use a recovery code" onPress={() => { setUseRecovery(true); setCode('') }} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, opacity: hovered ? 0.8 : 1 }, pointer]}>
              <Icon name="key" size={16} color={c.brand} /><Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.brand }}>Use a recovery code</Text>
            </Pressable>}
            <Pressable accessibilityRole="button" accessibilityLabel="Start again" disabled={busy} onPress={() => { setToken(''); setMethods([]); setCode(''); setPassword(''); setError(''); setUseRecovery(false) }} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [{ alignSelf: 'flex-start', opacity: hovered ? 0.8 : 1 }, pointer]}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>Start again</Text>
            </Pressable>
          </View>
        </View> : <>
        <View style={{ marginTop: 24, gap: 16 }}>
          <Field label={jivo ? 'JIVO email' : 'Email'} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="email" textContentType="username" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} editable={!blocked} style={{ fontSize: 16, minHeight: 52, paddingLeft: 16, paddingRight: 16, paddingVertical: 12 }} />
          <PasswordField ref={passwordRef} label={jivo ? 'JIVO password' : 'Password'} value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" returnKeyType="go" editable={!blocked} style={{ fontSize: 16, minHeight: 52, paddingLeft: 16, paddingRight: 52, paddingVertical: 12 }} onSubmitEditing={() => void submit()} />
          {!!(error || sessionError) && <Text accessibilityRole="alert" style={{ color: c.danger, backgroundColor: c.dangerSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.control, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' }}>{error || sessionError}</Text>}
          <Button loading={busy} style={{ minHeight: 48, marginTop: 4 }} title={busy ? 'Signing in…' : 'Sign in'} onPress={() => void submit()} disabled={blocked || !email.trim() || !password} />
        </View>
        {passkeysSupported() && offerPasskey && <>
          <View style={{ marginVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, height: 1, backgroundColor: c.border }} /><Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>or</Text><View style={{ flex: 1, height: 1, backgroundColor: c.border }} /></View>
          <IconTextButton variant="secondary" icon="fingerprint" title="Sign in with a passkey" onPress={() => void passkey()} disabled={blocked} />
        </>}
        </>}
      </Card>
      {/* Fake-data workspace shortcut: the reference has none, so it shows only in a development build started with EXPO_PUBLIC_DEV_PREVIEW=1. /preview itself stays reachable. */}
      {__DEV__ && process.env.EXPO_PUBLIC_DEV_PREVIEW === '1' && <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, alignItems: 'center' }}><Link href="/preview" style={{ color: c.primary, padding: 12, textAlign: 'center', fontSize: 12 }}>Preview responsive workspace</Link></View>}
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>
}
