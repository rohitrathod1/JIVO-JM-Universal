/**
 * One person's page (reference admin/pages/UserDetailPage): "← People", a header card with the photo, name,
 * status / two-step badges, email and last sign-in, the reset-link button and a "More actions" menu; then
 * Details, Access, Effective permissions, Communication access and Signed-in devices as p-5 surfaces.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { Platform, Pressable, Text, View, useWindowDimensions, type ViewStyle } from 'react-native'
import * as admin from '../modules/admin/api'
import { useSession } from '../core/auth/Session'
import { useIdentity } from '../core/auth/identity'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { formatDateTime, formatRelative } from '../shared/utils/format'
import { Button, Card, ErrorState, Field, Spinner, Surface, glass, radius, useColors } from '../ui'
import { Icon, type IconName } from './Icon'
import { Badge, IconTextButton, type Tone } from './AdminUi'
import { AdminFeedback, PersonChat, PersonCompanies, useAdminOperation } from './AdminManagement'
import { AdminPassword } from './AdminPassword'
import { ChatAvatar } from './ChatAvatar'
import { Sheet } from './Sheet'

const web = Platform.OS === 'web'
const pointer: ViewStyle = web ? ({ cursor: 'pointer' } as ViewStyle) : {}
const STATUS: Record<string, { label: string; tone: Tone }> = { active: { label: 'Active', tone: 'success' }, invited: { label: 'Invited', tone: 'info' }, inactive: { label: 'Inactive', tone: 'warning' }, deleted: { label: 'Deleted', tone: 'danger' } }
const AREAS = [{ area: 'JM', title: 'JM (Messenger)' }, { area: 'JP', title: 'JP (Passwords)' }, { area: 'ADMIN', title: 'Administration' }] as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors()
  return <Surface style={{ padding: 20, overflow: 'visible' }}>
    <Text accessibilityRole="header" style={{ marginBottom: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 24, color: c.text }}>{title}</Text>
    {children}
  </Surface>
}

function Checkbox({ checked, disabled, onToggle, label, description, extra }: { checked: boolean; disabled?: boolean; onToggle: () => void; label: string; description?: string; extra?: ReactNode }) {
  const c = useColors()
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={checked} accessibilityState={{ checked, disabled: !!disabled }} disabled={disabled} onPress={onToggle}
    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, opacity: disabled ? 0.6 : 1, ...(disabled ? {} : pointer) }}>
    <View style={{ marginTop: 2, width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primary : c.dark ? 'rgba(255,255,255,0.05)' : '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
      {checked && <Icon name="check" size={12} color="#ffffff" />}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}><Text style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>{label}</Text>{extra}</View>
      {!!description && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{description}</Text>}
    </View>
  </Pressable>
}

/** Two columns from 640px (reference grid gap-4 sm:grid-cols-2). */
function Grid({ children, gap = 16 }: { children: ReactNode[]; gap?: number }) {
  const two = useWindowDimensions().width >= 640
  const items = children.filter(Boolean)
  if (!two) return <View style={{ gap }}>{items}</View>
  const rows: ReactNode[][] = []
  items.forEach((item, i) => { if (i % 2 === 0) rows.push([item]); else rows[rows.length - 1].push(item) })
  return <View style={{ gap }}>{rows.map((row, i) => <View key={i} style={{ flexDirection: 'row', gap }}>{row.map((item, j) => <View key={j} style={{ flex: 1, minWidth: 0 }}>{item}</View>)}{row.length === 1 && <View style={{ flex: 1 }} />}</View>)}</View>
}

function Details({ user, onSaved }: { user: admin.AdminUser; onSaved: () => void }) {
  const { jivo } = useIdentity(); const op = useAdminOperation()
  const [v, setV] = useState({ full_name: user.full_name, display_name: user.display_name, employee_code: user.employee_code ?? '', phone: user.phone ?? '' })
  const set = (key: keyof typeof v) => (value: string) => setV(old => ({ ...old, [key]: value }))
  const hint = jivo ? 'From their JIVO account' : undefined
  return <View style={{ gap: 16 }}>
    <Grid>{[
      <Field key="f" label="Full name" value={v.full_name} onChangeText={set('full_name')} editable={!jivo && !user.is_deleted} hint={hint} />,
      <Field key="d" label="Display name" value={v.display_name} onChangeText={set('display_name')} editable={!user.is_deleted} />,
      <Field key="e" label="Employee code" value={v.employee_code} onChangeText={set('employee_code')} editable={!jivo && !user.is_deleted} hint={hint} />,
      <Field key="p" label="Phone" value={v.phone} onChangeText={set('phone')} editable={!user.is_deleted} keyboardType="phone-pad" />,
    ]}</Grid>
    {!user.is_deleted && <View style={{ alignSelf: 'flex-start' }}><Button title="Save details" loading={op.busy} disabled={op.busy} onPress={() => void op.run(() => admin.updateUser(user.id, jivo ? { display_name: v.display_name, phone: v.phone } : { ...v, employee_code: v.employee_code || null }), onSaved)} /></View>}
    <AdminFeedback op={op} />
  </View>
}

function Access({ user, isSelf, onSaved }: { user: admin.AdminUser; isSelf: boolean; onSaved: () => void }) {
  const c = useColors(); const options = useResource(admin.groupOptions); const groups = useResource(admin.listGroups); const op = useAdminOperation()
  const [selected, setSelected] = useState(user.groups)
  const describe = Object.fromEntries((groups.value ?? []).map(g => [g.name, g]))
  const area = (name: string) => { const g = describe[name]; if (!g) return 'JM'; const jp = g.capabilities.some(k => k.startsWith('JP_')); const jm = g.capabilities.some(k => !k.startsWith('JP_')); return jp && jm ? 'BOTH' : jp ? 'JP' : 'JM' }
  const dirty = [...selected].sort().join('|') !== [...user.groups].sort().join('|')
  const locked = isSelf || user.is_deleted
  return <View>
    {isSelf && <Text style={{ marginBottom: 12, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>You cannot change your own access. Ask another administrator.</Text>}
    {options.loading && <Spinner label="Loading groups" />}
    {!!options.error && <ErrorState message={errorMessage(options.error)} onRetry={options.refresh} />}
    <Grid gap={12}>{(options.value ?? []).map(o => { const checked = selected.includes(o.name); const a = area(o.name)
      return <Checkbox key={o.name} label={o.name} checked={checked} disabled={locked || !o.grantable} description={describe[o.name]?.description}
        onToggle={() => setSelected(s => checked ? s.filter(n => n !== o.name) : [...s, o.name])}
        extra={<>{a === 'JP' && <Badge tone="warning">Passwords</Badge>}{a === 'BOTH' && <Badge tone="warning">JM + Passwords</Badge>}{!o.grantable && !isSelf && <Badge tone="neutral">You can’t grant this</Badge>}</>} /> })}</Grid>
    {!locked && <View style={{ marginTop: 16, alignSelf: 'flex-start' }}><Button title="Save access" loading={op.busy} disabled={!dirty || op.busy} onPress={() => void op.run(async () => {
      // Recheck what may still be granted before replacing the memberships.
      const current = await admin.groupOptions(); const grantable = new Set(current.filter(g => g.grantable).map(g => g.name))
      const changed = [...new Set([...user.groups, ...selected])].filter(g => user.groups.includes(g) !== selected.includes(g))
      if (changed.some(g => !grantable.has(g))) throw Error('One of these groups can no longer be granted.')
      return admin.setUserGroups(user.id, selected)
    }, onSaved)} /></View>}
    <View style={{ marginTop: op.error || op.notice ? 12 : 0 }}><AdminFeedback op={op} /></View>
  </View>
}

function Permissions({ user }: { user: admin.AdminUser }) {
  const c = useColors(); const perms = user.permissions ?? []
  const text = { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.text } as const
  if (!perms.length) return <Text style={{ ...text, color: c.muted }}>No permissions. They cannot use JM until they are in a group.</Text>
  const warn = (msg: string) => <Text style={{ ...text, backgroundColor: c.warningSoft, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 8 }}>{msg}</Text>
  return <View style={{ gap: 16 }}>
    {perms.every(p => !p.effective) && warn('This account cannot sign in, so none of these apply right now.')}
    {perms.some(p => p.needs_two_step) && warn('Two-step verification is ON: the marked permissions work only after they add a passkey and sign in with it.')}
    {AREAS.map(({ area, title }) => { const rows = perms.filter(p => p.area === area); return <View key={area}>
      <Text style={{ marginBottom: 4, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: c.muted }}>{`${title} · ${rows.length || 'none'}`.toUpperCase()}</Text>
      {rows.map((p, i) => <View key={p.key} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
        <View style={{ flex: 1, minWidth: 160 }}><Text style={{ ...text, fontFamily: 'Inter_500Medium', fontWeight: '500' }}>{p.label}</Text><Text style={{ fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' }), fontSize: 11, lineHeight: 16, color: c.muted }}>{p.key}</Text></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 }}>{p.groups.map(g => <Badge key={g}>via {g}</Badge>)}{p.direct && <Badge tone="info">Direct</Badge>}{p.superuser && <Badge tone="brand">Superuser</Badge>}{p.needs_two_step && <Badge tone="warning">Needs two-step</Badge>}</View>
      </View>)}
    </View> })}
  </View>
}

function Devices({ id }: { id: string }) {
  const c = useColors(); const load = useCallback(() => admin.listUserDevices(id), [id]); const resource = useResource(load); const op = useAdminOperation(); const [target, setTarget] = useState<string | null>(null); const sm = useWindowDimensions().width >= 640
  const rows = resource.value ?? []
  return <Section title="Signed-in devices">
    {resource.loading && !rows.length && <Spinner label="Loading devices" />}
    {!!resource.error && <ErrorState message={errorMessage(resource.error)} onRetry={resource.refresh} />}
    {!resource.loading && !resource.error && !rows.length && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>Not signed in anywhere.</Text>}
    {rows.map((d, i) => <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}><Icon name="laptop" size={16} color={c.muted} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>{d.device_label || 'Unknown device'}</Text>
        <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{d.auth_method} · active {formatRelative(d.last_seen_at)}</Text>
      </View>
      <IconTextButton size="sm" variant="ghost" icon="logout" title={sm ? 'Sign out' : ''} accessibilityLabel={`Revoke device ${d.device_label}`} onPress={() => setTarget(d.id)} />
    </View>)}
    <AdminFeedback op={op} />
    <Sheet visible={!!target} onClose={() => { if (!op.busy) setTarget(null) }} title={target === 'all' ? 'Sign out of all devices?' : 'Sign out of this device?'} description="They will need to sign in again there."
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Button title="Cancel" accessibilityLabel="Cancel session revocation" variant="secondary" onPress={() => setTarget(null)} /><Button title="Sign out" accessibilityLabel="Confirm session revocation" disabled={op.busy} onPress={() => void op.run(() => target === 'all' ? admin.revokeUserSessions(id) : admin.revokeUserDevice(id, target!), () => { setTarget(null); resource.refresh() })} /></View>} />
  </Section>
}

type MenuEntry = { icon: IconName; label: string; a11y: string; danger?: boolean; separator?: boolean; onPress: () => void }
function MoreMenu({ items }: { items: MenuEntry[] }) {
  const c = useColors(); const [open, setOpen] = useState(false); const [hover, setHover] = useState<string | null>(null)
  return <View style={{ zIndex: 30 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="More actions" accessibilityState={{ expanded: open }} onPress={() => setOpen(v => !v)}
      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [{ width: web ? 40 : 44, height: web ? 40 : 44, borderRadius: radius.control, borderWidth: 1, borderColor: hovered ? 'rgba(22,163,74,0.4)' : c.border, backgroundColor: web ? c.glass2 : c.panel, alignItems: 'center', justifyContent: 'center' }, pointer]}>
      <Icon name="moreHorizontal" size={20} color={c.text} />
    </Pressable>
    {open && <>
      {web && <Pressable accessible={false} onPress={() => setOpen(false)} style={{ position: 'fixed' as 'absolute', top: 0, left: 0, right: 0, bottom: 0, cursor: 'default' } as unknown as ViewStyle} />}
      <View accessibilityRole="menu" style={[{ position: 'absolute', top: 46, right: 0, minWidth: 224, padding: 4, borderWidth: 1, borderRadius: radius.card }, glass(c, 4), { backgroundColor: c.dark ? '#111827' : '#ffffff' }]}>
        {items.map(item => <View key={item.a11y}>{item.separator && <View style={{ height: 1, marginVertical: 4, marginHorizontal: -4, backgroundColor: c.border }} />}
          <Pressable accessibilityRole="menuitem" accessibilityLabel={item.a11y} onPress={() => { setOpen(false); item.onPress() }} onHoverIn={() => setHover(item.a11y)} onHoverOut={() => setHover(null)}
            style={{ minHeight: 36, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: hover === item.a11y ? (item.danger ? 'rgba(220,38,38,0.1)' : c.hover) : 'transparent', ...pointer }}>
            <Icon name={item.icon} size={16} color={item.danger ? c.danger : c.text} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: item.danger ? c.danger : c.text }}>{item.label}</Text>
          </Pressable></View>)}
      </View>
    </>}
  </View>
}

export function PersonDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const c = useColors(); const { me } = useSession(); const { jivo } = useIdentity(); const { width } = useWindowDimensions(); const sm = width >= 640
  const load = useCallback(() => admin.getUser(id), [id]); const resource = useResource(load); const op = useAdminOperation()
  const [confirm, setConfirm] = useState<{ title: string; body: string; label: string; danger?: boolean; action: () => Promise<unknown>; after?: () => void } | null>(null)
  const [settingPassword, setSettingPassword] = useState(false)
  const refresh = () => { resource.refresh(); onChanged() }
  const u = resource.value; const isSelf = id === me?.id; const manages = !!me?.capabilities.includes('ADMIN_USERS')
  const back = <Pressable accessibilityRole="link" accessibilityLabel="Close person details" onPress={onClose} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, opacity: hovered ? 1 : 0.95 }, pointer]}>
    {({ hovered }: { hovered?: boolean; pressed: boolean }) => <><Icon name="back" size={16} color={hovered ? c.text : c.muted} /><Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: hovered ? c.text : c.muted }}>People</Text></>}
  </Pressable>
  if (!u) return <View style={{ gap: 16 }}>{back}{resource.loading && <Spinner label="Loading person" />}{!!resource.error && <ErrorState message={errorMessage(resource.error)} onRetry={resource.refresh} />}</View>
  const ask = (title: string, body: string, label: string, action: () => Promise<unknown>, danger = false, after?: () => void) => setConfirm({ title, body, label, action, danger, after })
  const s = STATUS[u.status] ?? { label: u.status, tone: 'neutral' as Tone }
  const menu: MenuEntry[] = isSelf || u.is_deleted ? [] : [
    ...(u.locked_out ? [{ icon: 'unlock' as const, label: 'Unlock sign-in', a11y: 'Unlock sign-in', onPress: () => void op.run(() => admin.unlockUser(id), refresh) }] : []),
    ...(u.mfa_enabled ? [{ icon: 'shieldOff' as const, label: 'Reset two-step verification', a11y: "Reset person's two-step verification", onPress: () => ask(`Reset two-step verification for ${u.name}?`, 'Their passkeys and recovery codes are removed. A second administrator may need to approve.', 'Reset', () => admin.resetUserMfa(id), true) }] : []),
    ...(!jivo && manages ? [{ icon: 'lockKeyhole' as const, label: 'Set password', a11y: 'Set password', onPress: () => setSettingPassword(true) }] : []),
    { icon: 'logout', label: 'Sign out of all devices', a11y: 'Revoke all person sessions', onPress: () => ask(`Sign ${u.name} out of all devices?`, 'They will need to sign in again everywhere.', 'Sign out', () => admin.revokeUserSessions(id)) },
    u.is_active ? { icon: 'power', label: 'Deactivate', a11y: 'Deactivate person', onPress: () => ask(`Deactivate ${u.name}?`, 'They are signed out everywhere and cannot sign in until reactivated.', 'Deactivate', () => admin.userAction(id, 'deactivate'), true) }
      : { icon: 'power', label: 'Activate', a11y: 'Reactivate person', onPress: () => ask(`Reactivate ${u.name}?`, 'They can sign in again.', 'Activate', () => admin.userAction(id, 'activate')) },
    { icon: 'trash2', label: 'Delete account', a11y: 'Delete person', danger: true, separator: true, onPress: () => ask(`Delete ${u.name}?`, 'They are signed out and hidden from people lists. The account can be restored from the Deleted list.', 'Delete', () => admin.deleteUser(id), true, onClose) },
  ]
  const linkButton = u.is_deleted ? <IconTextButton icon="rotateCcw" title="Restore account" accessibilityLabel="Restore person" onPress={() => ask('Restore this deleted person?', 'They get their account back with the access they had.', 'Restore', () => admin.userAction(id, 'restore'))} />
    : !jivo && u.status === 'invited' ? <IconTextButton variant="secondary" icon="link2" title="Invitation link" accessibilityLabel="Generate invitation link" onPress={() => void op.run(() => admin.inviteLink(id))} />
      : !isSelf && !jivo ? <IconTextButton variant="secondary" icon="key" title="Password reset link" accessibilityLabel="Generate password reset link" onPress={() => void op.run(() => admin.resetLink(id))} /> : null
  const muted = { fontFamily: 'Inter_400Regular', color: c.muted } as const
  return <View style={{ gap: 16 }}>
    {back}
    <Card style={{ zIndex: 20, padding: sm ? 20 : 16, gap: 16, flexDirection: sm ? 'row' : 'column', alignItems: sm ? 'center' : 'stretch' }}>
      <View style={{ flex: sm ? 1 : undefined, minWidth: 0, flexDirection: 'row', alignItems: sm ? 'center' : 'flex-start', gap: sm ? 16 : 12 }}>
        <ChatAvatar name={u.name} seed={u.id} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 }}>
            <Text accessibilityRole="header" style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: sm ? 20 : 18, lineHeight: 28, color: c.text }}>{u.name}</Text>
            {[<Badge key="s" tone={s.tone}>{s.label}</Badge>, u.is_superuser && <Badge key="su" tone="brand">Superuser · all permissions</Badge>, u.mfa_enabled ? <Badge key="m" tone="success">2-step on</Badge> : <Badge key="m">2-step off</Badge>,
              u.locked_out && <Badge key="l" tone="danger">Sign-in restricted on some addresses</Badge>, isSelf && <Badge key="y">You</Badge>].filter(Boolean).map((b, i) => <View key={i} style={{ alignSelf: 'center' }}>{b}</View>)}
          </View>
          <Text numberOfLines={sm ? 1 : undefined} style={{ ...muted, fontSize: 14, lineHeight: 20 }}>{u.email}</Text>
          {!!u.pending_email && !u.is_deleted && !jivo && <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderRadius: radius.control, backgroundColor: c.warningSoft, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ flex: 1, minWidth: 160, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.text }}>Asked to change their email to <Text style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600' }}>{u.pending_email}</Text>{u.pending_email_requested_at ? ` (${formatRelative(u.pending_email_requested_at)})` : ''}.</Text>
            <IconTextButton size="sm" title="Confirm" accessibilityLabel="Approve email change" onPress={() => void op.run(() => admin.decideEmailChange(id, 'approve'), refresh)} />
            <IconTextButton size="sm" variant="ghost" title="Refuse" accessibilityLabel="Reject email change" onPress={() => void op.run(() => admin.decideEmailChange(id, 'reject'), refresh)} />
          </View>}
          <Text style={{ ...muted, marginTop: 4, fontSize: 12, lineHeight: 16 }}>Last sign-in {u.last_login ? formatRelative(u.last_login) : 'never'}{u.is_deleted && u.deleted_at ? ` · deleted ${formatDateTime(u.deleted_at)}${u.deleted_by ? ` by ${u.deleted_by.name}` : ''}` : ''}</Text>
        </View>
      </View>
      {(!!linkButton || menu.length > 0) && <View style={{ flexDirection: 'row', gap: 8, ...(sm ? {} : { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 }) }}>
        {!!linkButton && <View style={sm ? undefined : { flex: 1 }}>{linkButton}</View>}
        {menu.length > 0 && <MoreMenu items={menu} />}
      </View>}
    </Card>
    {(op.busy || !!op.error || !!op.notice || !!op.link) && <AdminFeedback op={op} />}
    <Section title="Details"><Details key={[u.full_name, u.display_name, u.employee_code, u.phone].join('|')} user={u} onSaved={refresh} /></Section>
    {manages && <Section title="Access"><Access key={u.groups.join('|')} user={u} isSelf={isSelf} onSaved={refresh} /></Section>}
    <Section title="Effective permissions"><Permissions user={u} /></Section>
    {!u.is_deleted && manages && <Surface style={{ padding: 20, overflow: 'visible' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="messagesSquare" size={16} color={c.brand} /><Text accessibilityRole="header" style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 24, color: c.text }}>Communication access</Text></View>
      <Text style={{ ...muted, marginTop: 2, marginBottom: 16, fontSize: 14, lineHeight: 20 }}>Who {u.name} can chat with. Applies both ways, on every device, and is enforced by the server.</Text>
      <PersonChat id={id} isSelf={isSelf} />
    </Surface>}
    {!u.is_deleted && <Devices id={id} />}
    {/* The reference hides Companies on this page; memberships stay reachable here, last, for organisations that use them. */}
    {manages && u.companies.length > 0 && <Section title="Companies"><PersonCompanies user={u} onChanged={refresh} /></Section>}
    <Sheet visible={!!confirm} onClose={() => { if (!op.busy) setConfirm(null) }} title={confirm?.title} description={confirm?.body}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Button title="Cancel" accessibilityLabel="Cancel person action" variant="secondary" disabled={op.busy} onPress={() => setConfirm(null)} />
        <Button title={confirm?.label ?? 'Confirm'} accessibilityLabel="Confirm person action" disabled={op.busy} style={confirm?.danger ? { backgroundColor: c.danger } : undefined}
          onPress={() => { const current = confirm; if (!current) return; void op.run(async () => { if (!me?.capabilities.includes('ADMIN_USERS')) throw Error('People administration is no longer enabled.'); return current.action() }, () => { setConfirm(null); refresh(); current.after?.() }) }} />
      </View>} />
    <Sheet visible={settingPassword} onClose={() => setSettingPassword(false)} title={`Set a password for ${u.name}`} closeLabel="Close set password">
      <AdminPassword key={u.id} user={u} onChanged={refresh} />
    </Sheet>
  </View>
}
