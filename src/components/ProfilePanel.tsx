import { AppLockSetting } from './AppLock'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { InstallApp } from './InstallApp'
import { ProfileImages } from './ProfileImages'
import { Sheet } from './Sheet'
import { useSession } from '../core/auth/Session'
import { api, errorMessage } from '../core/api/client'
import * as profile from '../modules/profile/api'
import { addPasskey, passkeysSupported } from '../core/auth/security'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { SensitiveRequestGuard } from '../shared/sensitive'
import { Button, Card, Field, Label, styles, useColors } from '../ui'
export function ProfilePanel() {
  const { me, adopt } = useSession(); const c = useColors()
  const [name, setName] = useState(me?.display_name ?? ''); const [phone, setPhone] = useState(me?.phone ?? ''); const [bio, setBio] = useState(me?.bio ?? '')
  const [devices, setDevices] = useState<profile.DeviceSession[]>([]); const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState(''); const [repeat, setRepeat] = useState('')
  const [email, setEmail] = useState(''); const [passkeyName, setPasskeyName] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const recoveryGuard = useRef(new SensitiveRequestGuard())
  const clearRecovery = () => { recoveryGuard.current.clear(); setRecoveryCodes([]) }
  useEffect(() => { const guard = recoveryGuard.current; const off = subscribeSensitiveView(active => { guard.setActive(active); if (!active) setRecoveryCodes([]) }); return () => { off(); guard.setActive(false) } }, [])
  const [confirmation, setConfirmation] = useState<{ title: string; action: () => Promise<unknown> } | null>(null)
  useEffect(() => {
    let active = true
    profile.listSessions().then(data => { if (active) setDevices(data) }).catch(e => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [revision])
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('')
    try { await action(); await adopt(); setNotice(message); setRevision(v => v + 1); setConfirmation(null) }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false); setCurrentPassword(''); setPassword(''); setRepeat('') }
  }
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Label large>Profile</Label>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}
    {!!notice && <Label>{notice}</Label>}{busy && <ActivityIndicator />}
    <View style={{ width: '100%', maxWidth: 820, gap: 18, alignSelf: 'center' }}>
      <Card><Label large>{me?.name}</Label><Label>{me?.email}</Label>
        <Field label="Display name" value={name} onChangeText={setName} maxLength={150} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="About" value={bio} onChangeText={setBio} multiline maxLength={300} />
        <Button title="Save profile" disabled={busy} onPress={() => void run(() => profile.updateMe({ display_name: name.trim(), phone, bio }), 'Profile updated.')} />
      </Card>
      <ProfileImages key={me?.id} /><InstallApp /><AppLockSetting /><Card><Label large>Sign-in email</Label>
        {me?.pending_email ? <><Label>Awaiting administrator confirmation: {me.pending_email}</Label><Button title="Cancel email change" disabled={busy} onPress={() => void run(profile.cancelEmailChange, 'Email change cancelled.')} /></> : <>
          <Field label="New email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Button title="Request email change" disabled={busy || !email.trim()} onPress={() => void run(() => profile.requestEmailChange(email.trim()), 'Email change requested. An administrator must confirm it.')} />
        </>}
      </Card>
      <Card><Label large>Password</Label>
        <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Confirm new password" value={repeat} onChangeText={setRepeat} secureTextEntry />
        <Button title="Change password" disabled={busy || !currentPassword || !password || password !== repeat} onPress={() => void run(() => profile.changePassword(currentPassword, password), 'Password changed.')} />
      </Card>
      <Card><Label large>Two-step verification</Label><Label>{me?.security.mfa_enrolled ? 'Enabled' : 'Not enrolled'}</Label>
        <Label>{me?.security.recovery_codes_left ?? 0} recovery codes remaining</Label>
        {me?.security.passkeys.map(p => <View key={p.id} style={{ gap: 8 }}><Label>{p.name}</Label><Label>Last used: {p.last_used_at ? new Date(p.last_used_at).toLocaleDateString() : 'Never'}</Label>
          <Button title={`Remove ${p.name}`} disabled={busy} onPress={() => setConfirmation({ title: `Remove passkey "${p.name}"? The server may require another enrolled key.`, action: () => api.delete(`/auth/passkeys/${p.id}/`) })} />
        </View>)}
        {passkeysSupported() ? <><Field label="Passkey name" value={passkeyName} onChangeText={setPasskeyName} /><Button title="Add passkey" disabled={busy || !passkeyName.trim()} onPress={() => void run(async () => { const generation = recoveryGuard.current.begin(); const result = await addPasskey(passkeyName.trim()); if (recoveryGuard.current.accepts(generation)) setRecoveryCodes(result.recovery_codes ?? []) }, 'Passkey added.')} /></> : <Label>Native passkey enrollment requires platform association and credential-provider integration.</Label>}
        {me?.security.mfa_enrolled && <Button title="Regenerate recovery codes" disabled={busy} onPress={() => setConfirmation({ title: 'Replace all existing recovery codes? Previously saved codes will stop working.', action: async () => { const generation = recoveryGuard.current.begin(); const { data } = await api.post<{ recovery_codes: string[] }>('/auth/recovery-codes/regenerate/'); if (recoveryGuard.current.accepts(generation)) setRecoveryCodes(data.recovery_codes) } })} />}
      </Card>
      <Card><Label large>Signed-in devices</Label>
        {devices.map(device => <View key={device.id} style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border }}>
          <Label>{device.device_label}{device.current ? ' • This device' : ''}</Label><Label>{device.auth_method} • {new Date(device.last_seen_at).toLocaleString()}</Label>
          {!device.current && <Button title={`Sign out ${device.device_label}`} disabled={busy} onPress={() => setConfirmation({ title: `Sign out "${device.device_label}"?`, action: () => profile.revokeSession(device.id) })} />}
        </View>)}
        <Button title="Sign out other devices" disabled={busy || devices.length < 2} onPress={() => setConfirmation({ title: 'Sign out all your other devices?', action: profile.revokeOtherSessions })} />
      </Card>
    </View>
    <Sheet visible={Boolean(confirmation)} onClose={() => { if (!busy) setConfirmation(null) }}><Label>{confirmation?.title}</Label>
      <Button title="Confirm" disabled={busy} onPress={() => { if (confirmation) void run(confirmation.action, 'Action completed.') }} />
      <Button title="Cancel" disabled={busy} onPress={() => setConfirmation(null)} />
    </Sheet>
    <Sheet visible={recoveryCodes.length > 0} onClose={clearRecovery}>
      <Label large>Save your recovery codes</Label><Label>Keep these somewhere secure. They are shown only in memory and cleared when this view closes or the app leaves the foreground.</Label>
      {recoveryCodes.map(code => <Text key={code} selectable style={{ color: c.text, fontFamily: 'monospace' }}>{code}</Text>)}
      <Button title="I have saved my codes" onPress={clearRecovery} />
    </Sheet>
  </ScrollView>
}
