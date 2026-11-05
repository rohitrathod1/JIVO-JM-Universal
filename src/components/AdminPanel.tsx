import { SoftwareTools } from './SoftwareTools'
import { approvalConsequence } from '../modules/admin/approvalReview'
import { PersonDetail } from './AdminPerson'
import { CreatePerson, GroupManagement, SecurityPolicyPanel, useAdminOperation, AdminFeedback } from './AdminManagement'
import { useCallback, useState } from 'react'
import { useRouter } from 'expo-router'
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import * as admin from '../modules/admin/api'
import { useSession } from '../core/auth/Session'
import { useIdentity } from '../core/auth/identity'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { Button, EmptyState, ErrorState, Field, Label, Spinner, Surface, glass, styles, useColors } from '../ui'
import { Icon } from './Icon'
import { formatRelative } from '../shared/utils/format'
import { ChatAvatar } from './ChatAvatar'
import { Badge, HoverRow, IconTextButton, PageHeader, PillTabs, RowIconButton, SearchInput, Select, tableHead, type Tone } from './AdminUi'
import { ConfirmDialog, Sheet } from './Sheet'
type Draft = { title: string; fields: { key: string; label: string; value: string; readOnly?: string }[]; save: (fields: Record<string, string>) => Promise<unknown> }
function Editor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const c = useColors(); const [values, setValues] = useState(Object.fromEntries(draft.fields.map(f => [f.key, f.value]))); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>{draft.title}</Label>{draft.fields.map(field => <View key={field.key} style={{ gap: 4 }}><Field label={field.label} value={values[field.key]} editable={!field.readOnly} onChangeText={value => setValues(v => ({ ...v, [field.key]: value }))} />{!!field.readOnly && <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 12, lineHeight: 16 }}>{field.readOnly}</Text>}</View>)}{!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}
    <Button title="Save changes" disabled={busy} onPress={() => { setBusy(true); void draft.save(Object.fromEntries(draft.fields.filter(f => !f.readOnly).map(f => [f.key, values[f.key]]))).then(onSaved).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} /><Button title="Cancel changes" disabled={busy} onPress={onClose} />
  </Sheet>
}
const PEOPLE_STATUSES = [['', 'Current'], ['active', 'Active'], ['invited', 'Invited'], ['inactive', 'Inactive'], ['deleted', 'Deleted']] as const
const STATUS_BADGE: Record<string, { label: string; tone: Tone }> = { active: { label: 'Active', tone: 'success' }, invited: { label: 'Invited', tone: 'info' }, inactive: { label: 'Inactive', tone: 'warning' }, deleted: { label: 'Deleted', tone: 'danger' } }
const PAGE_SIZE = 50
function PersonBadges({ user, column }: { user: admin.AdminUser; column?: boolean }) {
  const s = STATUS_BADGE[user.status] ?? { label: user.status, tone: 'neutral' as Tone }
  return <View style={{ flexDirection: column ? 'column' : 'row', flexWrap: column ? 'nowrap' : 'wrap', alignItems: column ? 'flex-end' : 'center', gap: 4 }}>
    <Badge tone={s.tone}>{s.label}</Badge>{user.is_superuser && <Badge tone="brand">Superuser</Badge>}{user.mfa_enabled && <Badge tone="success">2-step</Badge>}{user.locked_out && <Badge tone="danger">Sign-in restricted on some addresses</Badge>}
  </View>
}
// Reference UsersPage: header, search, Status / Group dropdowns, a table from 768px and person rows on phones.
function People({ initialUser, onPerson }: { initialUser?: string; onPerson?: (open: boolean) => void }) {
  const [creating,setCreating] = useState(false); const [managing,setManagingState] = useState<string | null>(initialUser ?? null)
  const setManaging = (value: string | null) => { setManagingState(value); onPerson?.(!!value) }; const { jivo } = useIdentity(); const { me } = useSession()
  // Reference UsersPage: a trash button (with a ConfirmDialog) on every row except your own and deleted ones.
  const [deleting, setDeleting] = useState<admin.AdminUser | null>(null); const [removing, setRemoving] = useState(false); const [removeError, setRemoveError] = useState('')
  const canDelete = (user: admin.AdminUser) => user.id !== me?.id && !user.is_deleted
  const rowAction = (user: admin.AdminUser) => canDelete(user) ? <RowIconButton icon="trash2" danger label={`Delete ${user.name}`} onPress={() => setDeleting(user)} />
    : !user.is_deleted ? <RowIconButton icon="pencil" label={`Edit person ${user.name}`} onPress={() => edit(user)} /> : <View style={{ width: 32 }} />
  const c = useColors(); const { width } = useWindowDimensions(); const table = width >= 768
  // Reference table columns are content-sized: the person column takes more room on tablets.
  const cols = width >= 1100 ? [341, 414, 327, 174] : [36, 25, 17, 17]
  const [query, setQuery] = useState(''); const [status, setStatus] = useState<string>(''); const [group, setGroup] = useState(''); const [number, setNumber] = useState(1)
  const load = useCallback(() => admin.listUsers({ q: query.trim(), status, group, page: number }), [query, status, group, number]); const resource = useResource(load)
  const groupList = useResource(admin.listGroups)
  const [editor, setEditor] = useState<Draft | null>(null)
  const edit = (user: admin.AdminUser) => setEditor({ title: 'Edit person', fields: [{ key: 'full_name', label: 'Full name', value: user.full_name, readOnly: jivo ? 'From their JIVO account' : undefined }, { key: 'display_name', label: 'Display name', value: user.display_name }, { key: 'phone', label: 'Phone', value: user.phone }, { key: 'employee_code', label: 'Employee code', value: user.employee_code ?? '', readOnly: jivo ? 'From their JIVO account' : undefined }], save: values => admin.updateUser(user.id, 'employee_code' in values ? { ...values, employee_code: values.employee_code || null } : values) })
  const rows = resource.value?.results ?? []; const count = resource.value?.count ?? 0; const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const narrowed = !!(query.trim() || group)
  const muted = { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted } as const
  const name = { fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: table ? 14 : 16, lineHeight: table ? 20 : 22, color: c.text } as const
  const groupOptions: (readonly [string, string])[] = [['', 'All groups'], ...(groupList.value ?? []).map(g => [g.name, g.name] as const)]
  // Reference /admin/users/:id: the person's page replaces the list; "← People" comes back to it.
  if (managing) return <PersonDetail key={managing} id={managing} onClose={() => setManaging(null)} onChanged={resource.refresh} />
  return <View>
    <PageHeader title="People" subtitle={resource.value ? `${count} ${status || 'current'} account${count === 1 ? '' : 's'}` : undefined}
      actions={!jivo && <IconTextButton icon="userPlus" title="New person" accessibilityLabel="Create person" onPress={() => setCreating(true)} />} />
    {jivo && <Text style={{ marginBottom: 12, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>People with JM access in Jivo Auth appear here automatically. Open a person to assign their JM groups. They sign in with their JIVO email and password; no invitation is needed.</Text>}
    {creating && !jivo && <CreatePerson onClose={() => setCreating(false)} onSaved={resource.refresh} />}
    <SearchInput value={query} onChange={value => { setQuery(value); setNumber(1) }} placeholder="Search name, email or employee code" accessibilityLabel="Find people" style={{ marginBottom: 12, ...(table ? { maxWidth: 384 } : {}) }} />
    <View style={{ marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, zIndex: 10 }}>
      <Select label="Status" value={status} options={PEOPLE_STATUSES.filter(([v]) => !jivo || v !== 'invited')} onChange={value => { setStatus(value); setNumber(1) }} style={table ? { width: 224 } : { flex: 1 }} />
      <Select label="Group" value={group} options={groupOptions} onChange={value => { setGroup(value); setNumber(1) }} style={table ? { width: 224 } : { flex: 1 }} />
      {!!(narrowed || status) && <IconTextButton variant="ghost" size="sm" title="Clear filters" onPress={() => { setQuery(''); setStatus(''); setGroup(''); setNumber(1) }} />}
    </View>
    <Surface style={{ opacity: resource.loading && resource.value ? 0.7 : 1 }}>
      {resource.loading && !rows.length && <View style={{ padding: 32 }}><Spinner label="Loading people" /></View>}
      {!!resource.error && <ErrorState message={errorMessage(resource.error)} onRetry={resource.refresh} />}
      {!resource.loading && !resource.error && !rows.length && <EmptyState title={narrowed ? 'No one matches these filters.' : 'No accounts here.'} description={narrowed ? 'Try a different search, status or group.' : undefined} />}
      {rows.length > 0 && table && <View>
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border }}>
          {(['Person', 'Access', 'Status', 'Last sign-in'] as const).map((title, i) => [title, cols[i]] as const).map(([title, flex]) => <Text key={title} numberOfLines={1} style={[tableHead(c), { flex, paddingHorizontal: 16, paddingVertical: 12 }]}>{title}</Text>)}<View style={{ width: 48 }} />
        </View>
        {rows.map((user, index) => <HoverRow key={user.id} first={index === 0} onPress={() => setManaging(user.id)} accessibilityLabel={`Manage person ${user.name}`}
          trailing={<View style={{ width: 48, alignItems: 'flex-end', paddingRight: 8 }}>{rowAction(user)}</View>}>
          <View style={{ flex: cols[0], minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}><ChatAvatar name={user.name} seed={user.id} size={32} />
            <View style={{ minWidth: 0, flex: 1 }}><Text numberOfLines={1} style={name}>{user.name}</Text><Text numberOfLines={1} style={muted}>{user.email}{user.employee_code ? ` · ${user.employee_code}` : ''}</Text></View></View>
          <View style={{ flex: cols[1], flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 16, paddingVertical: 12 }}>{user.groups.map(g => <Badge key={g} tone={g.startsWith('Password') ? 'warning' : 'neutral'}>{g}</Badge>)}</View>
          <View style={{ flex: cols[2], paddingHorizontal: 16, paddingVertical: 12 }}><PersonBadges user={user} /></View>
          <Text numberOfLines={1} style={{ flex: cols[3], paddingHorizontal: 16, fontFamily: 'Inter_400Regular', fontSize: 14, color: c.muted }}>{user.last_login ? formatRelative(user.last_login) : 'Never'}</Text>
        </HoverRow>)}
      </View>}
      {rows.length > 0 && !table && <View>
        {rows.map((user, index) => <HoverRow key={user.id} first={index === 0} onPress={() => setManaging(user.id)} accessibilityLabel={`Manage person ${user.name}`} style={{ paddingLeft: 16, paddingRight: 8, paddingVertical: 12, gap: 12 }}
          trailing={<View style={{ marginRight: 8 }}>{rowAction(user)}</View>}>
          <ChatAvatar name={user.name} seed={user.id} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={name}>{user.name}</Text><Text numberOfLines={1} style={muted}>{user.email}</Text></View>
          <PersonBadges user={user} column />
        </HoverRow>)}
      </View>}
      {(pages > 1 || number > 1 || !!resource.value?.next) && <View accessibilityLabel="Pagination" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: c.muted }}>Page {number} of {pages} · {count} total</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}><IconTextButton variant="secondary" size="sm" icon="chevronLeft" title="" accessibilityLabel="Previous people page" disabled={number <= 1 || resource.loading} onPress={() => setNumber(v => v - 1)} /><IconTextButton variant="secondary" size="sm" icon="chevronRight" title="" accessibilityLabel="Next people page" disabled={!resource.value?.next || resource.loading} onPress={() => setNumber(v => v + 1)} /></View>
      </View>}
    </Surface>
    {editor && <Editor draft={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.refresh() }} />}
    <ConfirmDialog visible={!!deleting} onClose={() => { if (!removing) { setDeleting(null); setRemoveError('') } }} title={`Delete ${deleting?.name ?? ''}?`} confirmLabel="Delete" confirmAccessibilityLabel="Confirm delete person" danger loading={removing}
      body={<View style={{ gap: 8 }}><Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 14, lineHeight: 20 }}>They are signed out everywhere and removed from People. Their history is kept, and the account can be restored from the Deleted list.</Text>{!!removeError && <Text accessibilityRole="alert" style={{ fontFamily: 'Inter_400Regular', color: c.danger, fontSize: 14, lineHeight: 20 }}>{removeError}</Text>}</View>}
      onConfirm={() => { const target = deleting; if (!target) return; setRemoving(true); setRemoveError(''); void admin.deleteUser(target.id).then(() => { setDeleting(null); resource.refresh() }, e => setRemoveError(errorMessage(e))).finally(() => setRemoving(false)) }} />
  </View>
}
const loadCompanies = () => admin.listCompanies('all')
// Reference CompaniesPage: header, then one Surface list (colour dot, name + mono code, members, Inactive badge, edit).
function Companies() {
  const c = useColors(); const resource = useResource(loadCompanies); const [editor, setEditor] = useState<Draft | null>(null)
  const rows = resource.value ?? []
  return <View>
    <PageHeader title="Companies" subtitle="JIVO is one organisation in JM; companies show who belongs where." />
    <Surface>
      {resource.loading && !rows.length && <View style={{ padding: 32 }}><Spinner label="Loading companies" /></View>}
      {!!resource.error && <ErrorState message={errorMessage(resource.error)} onRetry={resource.refresh} />}
      {!resource.loading && !resource.error && !rows.length && <EmptyState title="No companies yet." />}
      {rows.map((company, index) => <HoverRow key={company.id} first={index === 0} style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}
        trailing={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 }}>
          {!company.is_active && !company.is_deleted && <Badge tone="warning">Inactive</Badge>}{company.is_deleted && <Badge tone="danger">Deleted</Badge>}
          {!company.is_deleted && <RowIconButton icon="pencil" label={`Edit company ${company.name}`} onPress={() => setEditor({ title: 'Edit company', fields: [{ key: 'name', label: 'Company name', value: company.name }, { key: 'short_name', label: 'Short name', value: company.short_name }, { key: 'code', label: 'Company code', value: company.code }], save: values => admin.saveCompany({ id: company.id, ...values }) })} />}
        </View>}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: company.color || c.muted }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 16, lineHeight: 24, color: c.text }}>{company.name} <Text style={{ fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' }), fontWeight: '400', fontSize: 12, color: c.muted }}>{company.code}</Text></Text>
          <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{company.is_deleted ? 'Deleted' : `${company.member_count} member${company.member_count === 1 ? '' : 's'}`}</Text>
        </View>
      </HoverRow>)}
    </Surface>
    {editor && <Editor draft={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.refresh() }} />}
  </View>
}
const GROUP_SECTIONS = [
  { area: 'JM', title: 'JM groups', hint: 'Messenger, alerts and administration.' },
  { area: 'JP', title: 'JP groups', hint: 'Passwords. What people see still depends on each vault.' },
  { area: 'BOTH', title: 'JM + JP groups', hint: 'Groups that grant both.' },
] as const
const groupArea = (g: admin.GroupInfo) => { const jp = g.capabilities.some(k => k.startsWith('JP_')); const jm = g.capabilities.some(k => !k.startsWith('JP_')); return jp && jm ? 'BOTH' : jp ? 'JP' : 'JM' }
function GroupCard({ group, onOpen, onEdit }: { group: admin.GroupInfo; onOpen: () => void; onEdit?: () => void }) {
  const c = useColors(); const [hover, setHover] = useState(false)
  return <View style={{ flex: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={`Manage permission group ${group.name}`} onPress={onOpen} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={[{ flex: 1, padding: 20, paddingBottom: onEdit ? 44 : 20, borderWidth: 1, borderRadius: 12 }, glass(c, 2), { borderColor: hover ? 'rgba(22,163,74,0.5)' : c.border }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 24, color: c.text }}>{group.name}</Text>
          <Badge tone={group.built_in ? 'neutral' : 'brand'}>{group.built_in ? 'Built-in' : 'Custom'}</Badge>
          {!group.can_manage_members && <Icon name="lock" size={14} color={c.muted} />}
        </View>
        {!!group.description && <Text style={{ marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.muted }}>{group.description}</Text>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="users" size={16} color={c.brand} /><Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: c.brand }}>{group.member_count}</Text>
        <View style={{ transform: [{ translateX: hover ? 2 : 0 }] }}><Icon name="chevronRight" size={16} color={c.muted} /></View>
      </View>
    </View>
    {group.capabilities.length > 0 && <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {group.capabilities.map(k => <Badge key={k} tone={k.startsWith('JP_') ? 'warning' : k.startsWith('ADMIN_') ? 'info' : 'neutral'} mono>{k}</Badge>)}
    </View>}
  </Pressable>{onEdit && <View style={{ position: 'absolute', right: 12, bottom: 8 }}><RowIconButton icon="pencil" label={`Edit group ${group.name}`} onPress={onEdit} /></View>}</View>
}
// Reference GroupsPage: header with "New group", search, then JM / JP / both sections of cards (two columns from 768px).
function Groups() {
  const { me } = useSession(); const [manage,setManage] = useState<admin.GroupInfo | 'new' | null>(null)
  const c = useColors(); const resource = useResource(admin.listGroups); const [editor, setEditor] = useState<Draft | null>(null); const [q, setQ] = useState('')
  const twoColumns = useWindowDimensions().width >= 768
  const rows = resource.value ?? []; const term = q.trim().toLowerCase()
  const shown = (term ? rows.filter(g => [g.name, g.description].some(t => t.toLowerCase().includes(term)) || g.capabilities.some(k => k.toLowerCase().includes(term))) : rows)
    .slice().sort((a, b) => Number(a.built_in) - Number(b.built_in) || a.name.localeCompare(b.name))
  const edit = (group: admin.GroupInfo) => setEditor({ title: 'Edit group', fields: [{ key: 'name', label: 'Group name', value: group.name }, { key: 'description', label: 'Description', value: group.description }], save: values => admin.updateGroup(group.id, values) })
  return <View>
    <PageHeader title="Permission groups" subtitle="Access comes only from these groups. Administrators can grant a group only if they hold everything in it."
      actions={me?.capabilities.includes('ADMIN_USERS') ? <IconTextButton icon="plus" title="New group" accessibilityLabel="New permission group" onPress={() => setManage('new')} /> : undefined} />
    {manage && <GroupManagement group={manage === 'new' ? undefined : manage} onClose={() => setManage(null)} onChanged={resource.refresh} />}
    {resource.loading && <View style={{ padding: 32 }}><Spinner label="Loading groups" /></View>}
    {!!resource.error && <ErrorState message={errorMessage(resource.error)} onRetry={resource.refresh} />}
    {!resource.loading && !resource.error && !rows.length && <EmptyState title="Nothing here yet." />}
    {rows.length > 0 && <SearchInput value={q} onChange={setQ} placeholder="Search groups or permissions" style={{ marginBottom: 16, ...(twoColumns ? { maxWidth: 448 } : {}) }} />}
    {rows.length > 0 && !shown.length && <Text style={{ paddingVertical: 32, textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14, color: c.muted }}>No group matches “{q}”.</Text>}
    {GROUP_SECTIONS.map(section => { const items = shown.filter(g => groupArea(g) === section.area); if (!items.length) return null
      const pairs = twoColumns ? items.reduce<admin.GroupInfo[][]>((all, g, i) => { if (i % 2 === 0) all.push([g]); else all[all.length - 1].push(g); return all }, []) : items.map(g => [g])
      return <View key={section.area} accessibilityLabel={section.title} style={{ marginBottom: 24 }}>
        <Text accessibilityRole="header" style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: c.muted }}>{section.title.toUpperCase()} <Text style={{ fontFamily: 'Inter_400Regular', fontWeight: '400', letterSpacing: 0 }}>· {items.length}</Text></Text>
        <Text style={{ marginBottom: 8, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{section.hint}</Text>
        <View style={{ gap: 16 }}>{pairs.map(pair => <View key={pair[0].id} style={{ flexDirection: 'row', gap: 16 }}>
          {pair.map(group => <GroupCard key={group.id} group={group} onOpen={() => setManage(group)} onEdit={group.can_edit ? () => edit(group) : undefined} />)}
          {twoColumns && pair.length === 1 && <View style={{ flex: 1 }} />}
        </View>)}</View>
      </View> })}
    {editor && <Editor draft={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.refresh() }} />}
  </View>
}
// Administration requests (two-person rule), in the same card style as the Approvals page.
function Approvals() {
  const c = useColors(); const [status, setStatus] = useState<'pending' | 'all'>('pending'); const load = useCallback(() => admin.listApprovals(status), [status]); const resource = useResource(load)
  const [decision, setDecision] = useState<{ item: admin.Approval; choice: 'approve' | 'deny' | 'cancel' } | null>(null); const op = useAdminOperation(); const busy = op.busy; const error = op.error
  const rows = resource.value ?? []
  const meta = { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted } as const
  const line = (text: string) => <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.text }}>{text}</Text>
  const tone = (st: string): Tone => st === 'pending' ? 'warning' : st === 'approved' || st === 'approve' ? 'success' : st === 'denied' || st === 'deny' ? 'danger' : 'neutral'
  return <View>
    <View style={{ marginBottom: 16 }}><PillTabs label="Show" value={status} options={[['pending', 'Pending'], ['all', 'History']] as const} onChange={setStatus} /></View>
    <AdminFeedback op={op} />
    {!!(error || resource.error) && <Text accessibilityRole="alert" style={{ marginBottom: 12, color: c.danger, fontFamily: 'Inter_400Regular' }}>{error || errorMessage(resource.error)}</Text>}
    {resource.loading && !rows.length && <Spinner label="Loading approvals" />}
    {!resource.loading && !resource.error && !rows.length && <EmptyState title={status === 'pending' ? 'Nothing waiting.' : 'No requests yet.'} />}
    <View style={{ gap: 12 }}>{rows.map(item => <Surface key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 }}>
      <View style={{ marginTop: 2 }}><Icon name="shieldCheck" size={20} color="#d97706" /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 16, lineHeight: 24, color: c.text }}>{item.label}</Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, color: c.muted }}>· {item.target ? `${item.target.name} (${item.target.email})` : 'Organisation'}</Text>
          <Badge tone={tone(item.status)}>{item.status}</Badge>
        </View>
        <Text style={{ ...meta, marginTop: 2 }}>Asked by {item.requested_by.name} ({item.requested_by.email}) · {new Date(item.created_at).toLocaleString()}</Text>
        {!!item.reason && <Text style={{ marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: c.text }}>{'\u201c'}{item.reason}{'\u201d'}</Text>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {item.can.decide && <><IconTextButton size="sm" icon="check" title="Approve" accessibilityLabel={`Approve ${item.label}`} disabled={busy} onPress={() => setDecision({ item, choice: 'approve' })} /><IconTextButton size="sm" icon="x" variant="secondary" title="Deny" accessibilityLabel={`Deny ${item.label}`} disabled={busy} onPress={() => setDecision({ item, choice: 'deny' })} /></>}
        {item.can.cancel && <IconTextButton size="sm" variant="ghost" title="Withdraw" accessibilityLabel={`Cancel ${item.label}`} disabled={busy} onPress={() => setDecision({ item, choice: 'cancel' })} />}
      </View>
    </Surface>)}</View>
    <Sheet visible={Boolean(decision)} onClose={() => { if (!busy) setDecision(null) }} title={decision ? `Confirm ${decision.choice}` : undefined} closeLabel="Close decision"
      footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        <Button title="Go back" variant="secondary" disabled={busy} onPress={() => setDecision(null)} />
        <Button title="Confirm decision" disabled={busy} style={decision?.choice === 'approve' ? { backgroundColor: c.danger } : undefined} onPress={() => { if (!decision) return; void op.run(async () => { const current = (await admin.listApprovals(status)).find(v => v.id === decision.item.id); if (!current || !(decision.choice === 'cancel' ? current.can.cancel : current.can.decide)) throw Error('This approval can no longer be changed.'); if (current.kind !== decision.item.kind || current.target?.id !== decision.item.target?.id || current.target?.email !== decision.item.target?.email || current.requested_by.id !== decision.item.requested_by.id || current.expires_at !== decision.item.expires_at) throw Error('This approval changed. Close and review the current request.'); return admin.decideApproval(decision.item.id, decision.choice) }, () => { setDecision(null); resource.refresh() }) }} />
      </View>}>
      {decision && <View style={{ gap: 6 }}>{line(decision.item.label)}{line(`Target: ${decision.item.target ? `${decision.item.target.name} (${decision.item.target.email})` : 'Organisation'}`)}{line(`Requested by: ${decision.item.requested_by.name} (${decision.item.requested_by.email})`)}{line(`Requested: ${new Date(decision.item.created_at).toLocaleString()}`)}{line(`Expires: ${new Date(decision.item.expires_at).toLocaleString()}`)}{!!decision.item.reason && line(`Reason: ${decision.item.reason}`)}{line(approvalConsequence(decision.item, decision.choice))}</View>}
      <Text style={{ ...meta, marginTop: 8 }}>The server will recheck your authority and enforce the two-person rule.</Text>
    </Sheet>
  </View>
}
export function AdminPanel({ initialTab, initialUser }: { initialTab?: string; initialUser?: string }) {
  const router = useRouter(); const { me } = useSession(); const [tab, setTab] = useState<'people' | 'companies' | 'groups' | 'approvals' | 'security' | 'tools'>(initialTab === 'tools' || initialTab === 'companies' || initialTab === 'groups' || initialTab === 'approvals' || initialTab === 'security' ? initialTab : 'people')
  const managesUsers = me?.capabilities.includes('ADMIN_USERS') ?? false; const wide = useWindowDimensions().width >= 768; const [personOpen, setPersonOpen] = useState(!!initialUser)
  if (!managesUsers && !me?.capabilities.includes('ADMIN_AUDIT')) return <EmptyState title="Administration" description="Administration access is not enabled for your account." action={<Button title="Back to home" variant="secondary" onPress={() => router.replace('/home')} />} />
  const currentTab = managesUsers ? tab : 'groups'
  const sections = (managesUsers ? [['people', 'People'], ['groups', 'Permission groups'], ['security', 'Security'], ['tools', 'Software tools']] as const : [['groups', 'Permission groups']] as const) as readonly (readonly ['people' | 'groups' | 'security' | 'tools', string])[]
  const header = currentTab === 'companies' ? 'Companies' : currentTab === 'approvals' ? 'Approvals' : null
  // Reference: each section is its own page reached from the rail; phones have no rail, so a pill switcher stands in.
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { gap: 0 }]}>
    {!wide && sections.length > 1 && !(currentTab === 'people' && personOpen) && <View style={{ marginBottom: 16 }}><PillTabs horizontal label="Administration" value={currentTab as 'people'} options={sections} onChange={setTab} /></View>}
    {!!header && <PageHeader title={header} />}
    {!!header && !wide && <Label large>{header}</Label>}
    <View style={{ gap: currentTab === 'people' ? 0 : 12 }}>{currentTab === 'people' ? <People initialUser={initialUser} onPerson={setPersonOpen} /> : currentTab === 'companies' ? <Companies /> : currentTab === 'groups' ? <Groups /> : currentTab === 'security' ? <SecurityPolicyPanel /> : currentTab === 'tools' ? <SoftwareTools manage /> : <Approvals />}</View>
  </ScrollView>
}
