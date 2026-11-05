import { AppLockSetting } from './AppLock'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { InstallApp } from './InstallApp'
import { ProfileImages } from './ProfileImages'
import { ConfirmDialog, Sheet } from './Sheet'
import { Icon } from './Icon'
import { useSession } from '../core/auth/Session'
import { api, errorMessage } from '../core/api/client'
import * as profile from '../modules/profile/api'
import { addPasskey, passkeysSupported } from '../core/auth/security'
import { useIdentity } from '../core/auth/identity'
import { mobileError } from '../shared/phone'
import { isWide } from '../shared/shellLayout'
import { PasswordField } from './PasswordField'
import { ProfileSection, Pill, SettingRow, mutedText } from './ProfileSection'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { SensitiveRequestGuard } from '../shared/sensitive'
import { Button, Field, Label, radius, styles, useColors } from '../ui'
import { formatDate, formatRelative } from '../shared/utils/format'
import { SecurityNotices } from './SecurityNotices'
import { PasskeyRow } from './PasskeyRow'
import { IconTextButton } from './AdminUi'
const AUTH_LABEL: Record<string, string> = { password: 'Password', password_totp: 'Password + one-time code', passkey: 'Passkey', password_recovery: 'Password + recovery code' }
export function ProfilePanel() {
  const { me, adopt, logout } = useSession(); const c = useColors(); const { width } = useWindowDimensions(); const { jivo, canChangePassword } = useIdentity()
  const [phoneError, setPhoneError] = useState('')
  const [name, setName] = useState(me?.display_name ?? ''); const [phone, setPhone] = useState(me?.phone ?? ''); const [bio, setBio] = useState(me?.bio ?? '')
  const [devices, setDevices] = useState<profile.DeviceSession[]>([]); const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState(''); const [repeat, setRepeat] = useState('')
  const [email, setEmail] = useState(''); const [passkeyName, setPasskeyName] = useState<string | null>(null); const [changingEmail, setChangingEmail] = useState(false); const [signingOut, setSigningOut] = useState(false)
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
  const wide = width >= 640; const half = { flexBasis: wide ? '48%' : '100%', flexGrow: 1, minWidth: 0 } as const; const third = { flexBasis: wide ? '30%' : '100%', flexGrow: 1, minWidth: 0 } as const
  const mismatch = repeat.length > 0 && password !== repeat
  const others = devices.filter(d => !d.current).length
  const title = jivo ? me?.full_name || me?.name : me?.name
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    {isWide(width) && <View style={{ marginBottom: 4 }}><Label large>{title}</Label><Text style={{ marginTop: 4, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{jivo ? me?.email : me?.bio || me?.email}</Text></View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 14 }}>{error}</Text>}
    {!!notice && <Text accessibilityRole="alert" style={{ color: c.success, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{notice}</Text>}{busy && <ActivityIndicator color={c.brand} />}
    <View style={{ width: '100%', gap: 16 }}>
      <ProfileSection title="Your details"><View style={{ gap: 20 }}>
        <ProfileImages key={me?.id} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          <View style={half}><Field label="Full name" value={me?.full_name ?? ''} editable={false} hint={jivo ? 'From your JIVO account. Managed in Jivo Auth.' : 'Changed by an administrator.'} /></View>
          <View style={half}><Field label="Display name" value={name} onChangeText={setName} maxLength={150} placeholder={me?.full_name} hint="What people see in chats." /></View>
          <View style={{ width: '100%' }}><Field label="About" value={bio} onChangeText={setBio} multiline maxLength={300} placeholder={'E.g. Dispatch, Plant 2 · available 9–6'} style={{ minHeight: 56, textAlignVertical: 'top' }} hint={`${bio.length}/300 · visible to everyone in JM.`} /></View>
          <View style={half}><Field label="Mobile number *" accessibilityLabel="Mobile number" value={phone} onChangeText={value => { setPhone(value); if (phoneError) setPhoneError('') }} onBlur={() => setPhoneError(phone.trim() ? mobileError(phone) ?? '' : '')} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={24} placeholder="+91 98100 00000" error={phoneError || undefined} hint="Required. Shown only to people you chat with, so they can call you." /></View>
          {wide && <View style={half} />}
          <View style={{ width: '100%', gap: 8 }}>
            <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>Email</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Icon name="mail" size={16} color={c.muted} /><Text selectable numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, flexShrink: 1 }}>{me?.email}</Text>
              {jivo ? <Text style={mutedText(c.muted)}>From your JIVO account</Text> : !me?.pending_email && <Button size="sm" variant="ghost" title={changingEmail ? 'Cancel' : 'Change'} accessibilityLabel={changingEmail ? 'Cancel email change form' : 'Change email'} onPress={() => { setChangingEmail(v => !v); setEmail('') }} />}
            </View>
            {!jivo && !!me?.pending_email && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderRadius: radius.control, backgroundColor: c.warningSoft, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Icon name="clock" size={16} color={c.text} /><Text style={{ flex: 1, minWidth: 160, color: c.text, fontSize: 14, lineHeight: 20 }}>Awaiting administrator confirmation: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{me.pending_email}</Text>. You still sign in with {me.email}.</Text>
              <Button size="sm" variant="ghost" title="Withdraw" accessibilityLabel="Cancel email change" disabled={busy} onPress={() => void run(profile.cancelEmailChange, 'Email change cancelled.')} />
            </View>}
            {!jivo && !me?.pending_email && changingEmail && <View style={{ gap: 8, maxWidth: 420 }}>
              <Text style={mutedText(c.muted)}>The new address takes effect once an administrator confirms it; until then you keep signing in with the current one.</Text>
              <Field label="New email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <Button size="sm" title="Send request" accessibilityLabel="Request email change" style={{ alignSelf: 'flex-start' }} disabled={busy || !email.trim()} onPress={() => void run(async () => { await profile.requestEmailChange(email.trim()); setChangingEmail(false); setEmail('') }, 'Email change requested. An administrator must confirm it.')} />
            </View>}
          </View>
          <View style={{ width: '100%' }}><Button title="Save" accessibilityLabel="Save profile" style={{ alignSelf: 'flex-start' }} disabled={busy} onPress={() => { const problem = mobileError(phone); setPhoneError(problem ?? ''); if (!problem) void run(() => profile.updateMe({ display_name: name.trim(), phone: phone.trim(), bio: bio.trim() }), 'Profile updated.') }} /></View>
        </View>
      </View></ProfileSection>
      <ProfileSection title="Access">
        {!!me?.is_superuser && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}><Pill tone="brand">Superuser</Pill><Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14 }}>You hold every permission in JM, whatever your groups.</Text></View>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 }}>{!me?.groups.length ? <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14 }}>No permission groups.</Text> : me.groups.map(g => <Pill key={g}>{g}</Pill>)}</View>
      </ProfileSection>
      <ProfileSection title="Two-step verification" badge={me ? (me.security.mfa_enrolled ? <Pill tone="success">On</Pill> : <Pill>Off</Pill>) : null}>
        {!!me?.security.mfa_required && !me.security.mfa_enrolled && <View style={{ flexDirection: 'row', gap: 8, borderRadius: radius.control, backgroundColor: c.warningSoft, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}><Icon name="shield" size={16} color={c.text} /><Text style={{ flex: 1, color: c.text, fontSize: 14, lineHeight: 20 }}>Your role needs two-step verification. Add a passkey to unlock it.</Text></View>}
        {!me?.security.mfa_required && !me?.security.mfa_enrolled && <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20, marginBottom: 8, marginTop: -8 }}>Protect your account with a second step at sign-in.</Text>}
        <View style={{ marginTop: -12 }}>
          {me?.security.passkeys.map((p, index) => <PasskeyRow key={p.id} passkey={p} first={index === 0} disabled={busy} onRename={name => run(() => api.patch(`/auth/passkeys/${p.id}/`, { name }), 'Passkey renamed.')} onRemove={() => setConfirmation({ title: `Remove “${p.name}”? It will no longer sign you in.`, action: () => api.delete(`/auth/passkeys/${p.id}/`) })} />)}
          <SettingRow chip icon="fingerprint" first={!me?.security.passkeys.length} title="Passkeys" detail={passkeysSupported() ? 'Sign in with your fingerprint, face, or screen lock.' : 'Native passkey enrollment requires platform association and credential-provider integration.'}>
            {passkeysSupported() && (passkeyName === null ? <Button size="sm" variant={me?.security.passkeys.length ? 'secondary' : 'primary'} title="Add a passkey" onPress={() => setPasskeyName('')} />
              : <><View style={{ width: wide ? 200 : undefined, flexGrow: wide ? 0 : 1 }}><Field label="Passkey name" compact placeholder="Name, e.g. Work laptop" autoFocus value={passkeyName} onChangeText={setPasskeyName} maxLength={60} /></View><Button size="sm" title="Continue" accessibilityLabel="Add passkey" disabled={busy || !passkeyName.trim()} onPress={() => { const label = passkeyName.trim(); void run(async () => { const generation = recoveryGuard.current.begin(); const result = await addPasskey(label); setPasskeyName(null); if (recoveryGuard.current.accepts(generation)) setRecoveryCodes(result.recovery_codes ?? []) }, 'Passkey added.') }} /></>)}
          </SettingRow>
          {me?.security.mfa_enrolled && <SettingRow chip icon="key" title="Recovery codes" detail={`${me.security.recovery_codes_left ?? 0} of 10 left. Use one if you lose the device with your passkey.`}>
            <Button size="sm" variant="secondary" title="New codes" accessibilityLabel="Regenerate recovery codes" disabled={busy} onPress={() => setConfirmation({ title: 'Replace all existing recovery codes? Previously saved codes will stop working.', action: async () => { const generation = recoveryGuard.current.begin(); const { data } = await api.post<{ recovery_codes: string[] }>('/auth/recovery-codes/regenerate/'); if (recoveryGuard.current.accepts(generation)) setRecoveryCodes(data.recovery_codes) } })} />
          </SettingRow>}
        </View>
        {me?.security.mfa_enrolled && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}><Icon name="shield" size={14} color={c.muted} /><Text style={mutedText(c.muted)}>{'Changes here ask you to confirm it’s you first.'}</Text></View>}
      </ProfileSection>
      {!!me && <SecurityNotices userId={me.id} />}
      {canChangePassword && <ProfileSection title={jivo ? 'JIVO password' : 'Password'}>
        {jivo && <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>The same password for every JIVO app. Changing it here changes it everywhere.</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          <View style={third}><PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} autoComplete="current-password" /></View>
          <View style={third}><PasswordField label="New password" value={password} onChangeText={setPassword} autoComplete="new-password" /><Text style={{ ...mutedText(c.muted), marginTop: 6 }}>At least 12 characters.</Text></View>
          <View style={third}><PasswordField label="Repeat new password" value={repeat} onChangeText={setRepeat} autoComplete="new-password" />{mismatch && <Text style={{ ...mutedText(c.danger), marginTop: 6 }}>Does not match.</Text>}</View>
          <View style={{ width: '100%' }}><Button title="Change password" style={{ alignSelf: 'flex-start' }} disabled={busy || !currentPassword || !password || password !== repeat} onPress={() => void run(() => profile.changePassword(currentPassword, password), 'Password changed.')} /></View>
        </View>
      </ProfileSection>}
      <ProfileSection title="Signed-in devices" aside={<Button size="sm" variant="secondary" title="Sign out other devices" disabled={busy || others < 1} onPress={() => setConfirmation({ title: 'Sign out all your other devices?', action: profile.revokeOtherSessions })} />}>
        <View style={{ marginTop: -12 }}>{devices.map((device, index) => <SettingRow key={device.id} icon="laptop" first={index === 0}
          title={<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}><Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{device.device_label || 'Device'}</Text>{device.current && <Pill tone="brand">This device</Pill>}</View>}
          detail={`${AUTH_LABEL[device.auth_method] ?? 'Password'} · active ${formatRelative(device.last_seen_at)} · signed in ${formatDate(device.created_at)}${device.ip_last ? ` · ${device.ip_last}` : ''}`}>
          {!device.current && <IconTextButton icon="logout" size="sm" variant="ghost" title="Sign out" accessibilityLabel={`Sign out ${device.device_label}`} disabled={busy} onPress={() => setConfirmation({ title: `Sign out "${device.device_label}"?`, action: () => profile.revokeSession(device.id) })} />}
        </SettingRow>)}</View>
      </ProfileSection>
      <ProfileImages key={`bg:${me?.id}`} part="background" />
      <ProfileSection title="This device">
        <View style={{ marginTop: -12 }}><SettingRow first icon="logout" tone={c.danger} title="Sign out" detail="Sign out of JM on this device.">
          <Button size="sm" variant="danger" title="Sign out" accessibilityLabel="Sign out of JM on this device" disabled={busy} onPress={() => setSigningOut(true)} />
        </SettingRow><InstallApp /><AppLockSetting /></View>
      </ProfileSection>
    </View>
    <ConfirmDialog visible={signingOut} onClose={() => setSigningOut(false)} title="Sign out of JM?" body="You will need your password (and passkey, if you use one) to sign in again on this device." confirmLabel="Sign out" confirmAccessibilityLabel="Confirm sign out" danger onConfirm={() => { setSigningOut(false); void logout().catch(e => setError(errorMessage(e))) }} />
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
