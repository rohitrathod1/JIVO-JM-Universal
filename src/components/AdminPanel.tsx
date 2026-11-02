import { approvalConsequence } from '../modules/admin/approvalReview'
import { AddJivoPerson, CreatePerson, PersonManagement, GroupManagement, SecurityPolicyPanel, useAdminOperation, AdminFeedback } from './AdminManagement'
import { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import * as admin from '../modules/admin/api'
import { useSession } from '../core/auth/Session'
import { useIdentity } from '../core/auth/identity'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { Button, Card, Field, Label, styles, useColors } from '../ui'
import { Sheet } from './Sheet'
type Draft = { title: string; fields: { key: string; label: string; value: string; readOnly?: string }[]; save: (fields: Record<string, string>) => Promise<unknown> }
function Editor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const c = useColors(); const [values, setValues] = useState(Object.fromEntries(draft.fields.map(f => [f.key, f.value]))); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>{draft.title}</Label>{draft.fields.map(field => <View key={field.key} style={{ gap: 4 }}><Field label={field.label} value={values[field.key]} editable={!field.readOnly} onChangeText={value => setValues(v => ({ ...v, [field.key]: value }))} />{!!field.readOnly && <Text style={{ fontFamily: 'Inter_400Regular', color: c.muted, fontSize: 12, lineHeight: 16 }}>{field.readOnly}</Text>}</View>)}{!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}
    <Button title="Save changes" disabled={busy} onPress={() => { setBusy(true); void draft.save(Object.fromEntries(draft.fields.filter(f => !f.readOnly).map(f => [f.key, values[f.key]]))).then(onSaved).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} /><Button title="Cancel changes" disabled={busy} onPress={onClose} />
  </Sheet>
}
function People({ initialUser }: { initialUser?: string }) {
  const [creating,setCreating] = useState(false); const [managing,setManaging] = useState<string | null>(initialUser ?? null); const { jivo } = useIdentity()
  const c = useColors(); const [query, setQuery] = useState(''); const [status, setStatus] = useState('active'); const [number, setNumber] = useState(1)
  const load = useCallback(() => admin.listUsers({ q: query, status, page: number }), [query, status, number]); const resource = useResource(load)
  const [editor, setEditor] = useState<Draft | null>(null)
  return <View style={{ gap: 12 }}><Button title={jivo ? 'New person' : 'Create person'} onPress={() => setCreating(true)} />{creating && (jivo ? <AddJivoPerson onClose={() => setCreating(false)} onSaved={resource.refresh} onManage={id => { setCreating(false); setManaging(id) }} /> : <CreatePerson onClose={() => setCreating(false)} onSaved={resource.refresh} />)}{managing && <PersonManagement key={managing} id={managing} onClose={() => setManaging(null)} onChanged={resource.refresh} />}<Field label="Find people" value={query} onChangeText={value => { setQuery(value); setNumber(1) }} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['active', 'invited', 'inactive', 'deleted', 'all'].map(value => <Button key={value} title={`${value}${status === value ? ' selected' : ''}`} onPress={() => { setStatus(value); setNumber(1) }} />)}</View>
    {resource.loading && <ActivityIndicator />}{!!resource.error && <Text accessibilityRole="alert" style={{ color: c.text }}>{errorMessage(resource.error)}</Text>}
    {resource.value?.results.map(user => <Card key={user.id}><Label large>{user.name}</Label><Label>{user.email}</Label><Label>{user.status} · {user.mfa_enabled ? 'Two-step enabled' : 'Two-step not enrolled'}</Label><Label>{user.companies.map(co => co.company_name).join(', ')}</Label><Label>{user.groups.join(', ')}</Label>
      <Button title={`Manage person ${user.name}`} onPress={() => setManaging(user.id)} /><Button disabled={user.is_deleted} title={`Edit person ${user.name}`} onPress={() => setEditor({ title: 'Edit person', fields: [{ key: 'full_name', label: 'Full name', value: user.full_name, readOnly: jivo ? 'From their JIVO account' : undefined }, { key: 'display_name', label: 'Display name', value: user.display_name }, { key: 'phone', label: 'Phone', value: user.phone }, { key: 'employee_code', label: 'Employee code', value: user.employee_code ?? '', readOnly: jivo ? 'From their JIVO account' : undefined }], save: values => admin.updateUser(user.id, 'employee_code' in values ? { ...values, employee_code: values.employee_code || null } : values) })} />
    </Card>)}
    <View style={{ flexDirection: 'row', gap: 12 }}><Button title="Previous people page" disabled={number <= 1 || resource.loading} onPress={() => setNumber(v => v - 1)} /><Button title="Next people page" disabled={!resource.value?.next || resource.loading} onPress={() => setNumber(v => v + 1)} /></View><Label>Page {number} · {resource.value?.count ?? 0} people</Label>
    {editor && <Editor draft={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.refresh() }} />}
  </View>
}
const loadCompanies = () => admin.listCompanies('all')
function Companies() {
  const c = useColors(); const resource = useResource(loadCompanies); const [editor, setEditor] = useState<Draft | null>(null)
  return <View style={{ gap: 12 }}>{resource.loading && <ActivityIndicator />}{!!resource.error && <Text accessibilityRole="alert" style={{ color: c.text }}>{errorMessage(resource.error)}</Text>}
    {resource.value?.map(company => <Card key={company.id}><Label large>{company.name}</Label><Label>{company.code} · {company.member_count} members · {company.is_deleted ? 'Deleted' : company.is_active ? 'Active' : 'Inactive'}</Label><Button title={`Edit company ${company.name}`} disabled={company.is_deleted} onPress={() => setEditor({ title: 'Edit company', fields: [{ key: 'name', label: 'Company name', value: company.name }, { key: 'short_name', label: 'Short name', value: company.short_name }, { key: 'code', label: 'Company code', value: company.code }], save: values => admin.saveCompany({ id: company.id, ...values }) })} /></Card>)}
    {editor && <Editor draft={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.refresh() }} />}
  </View>
}
function Groups() {
  const { me } = useSession(); const [manage,setManage] = useState<admin.GroupInfo | 'new' | null>(null)
  const c = useColors(); const resource = useResource(admin.listGroups); const [editor, setEditor] = useState<Draft | null>(null)
  return <View style={{ gap: 12 }}>{me?.capabilities.includes('ADMIN_USERS') && <Button title="New permission group" onPress={() => setManage('new')} />}{manage && <GroupManagement group={manage === 'new' ? undefined : manage} onClose={() => setManage(null)} onChanged={resource.refresh} />}{resource.loading && <ActivityIndicator />}{!!resource.error && <Text accessibilityRole="alert" style={{ color: c.text }}>{errorMessage(resource.error)}</Text>}
    {resource.value?.map(group => <Card key={group.id}><Label large>{group.name}</Label><Label>{group.description}</Label><Label>{group.member_count} members{group.built_in ? ' · Built in' : ''}</Label><Label>{group.capabilities.join(', ')}</Label><Button title={`Manage permission group ${group.name}`} onPress={() => setManage(group)} />{group.can_edit && <Button title={`Edit group ${group.name}`} onPress={() => setEditor({ title: 'Edit group', fields: [{ key: 'name', label: 'Group name', value: group.name }, { key: 'description', label: 'Description', value: group.description }], save: values => admin.updateGroup(group.id, values) })} />}</Card>)}
    {editor && <Editor draft={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.refresh() }} />}
  </View>
}
function Approvals() {
  const c = useColors(); const [status, setStatus] = useState<'pending' | 'all'>('pending'); const load = useCallback(() => admin.listApprovals(status), [status]); const resource = useResource(load)
  const [decision, setDecision] = useState<{ item: admin.Approval; choice: 'approve' | 'deny' | 'cancel' } | null>(null); const op = useAdminOperation(); const busy = op.busy; const error = op.error
  return <View style={{ gap: 12 }}><AdminFeedback op={op} /><Button title={status === 'pending' ? 'Show all approvals' : 'Show pending approvals'} onPress={() => setStatus(v => v === 'pending' ? 'all' : 'pending')} />
    {!!(error || resource.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || errorMessage(resource.error)}</Text>}{resource.loading && <ActivityIndicator />}
    {resource.value?.map(item => <Card key={item.id}><Label large>{item.label}</Label><Label>{item.target ? `${item.target.name} (${item.target.email})` : 'Organisation'}</Label><Label>{item.reason}</Label><Label>Requested by {item.requested_by.name} ({item.requested_by.email}) - {item.status}</Label>{item.can.decide && <><Button title={`Approve ${item.label}`} disabled={busy} onPress={() => setDecision({ item, choice: 'approve' })} /><Button title={`Deny ${item.label}`} disabled={busy} onPress={() => setDecision({ item, choice: 'deny' })} /></>}{item.can.cancel && <Button title={`Cancel ${item.label}`} disabled={busy} onPress={() => setDecision({ item, choice: 'cancel' })} />}</Card>)}
    <Sheet visible={Boolean(decision)} onClose={() => { if (!busy) setDecision(null) }}><Label large>Confirm {decision?.choice}</Label>{decision && <><Label>{decision.item.label}</Label><Label>Target: {decision.item.target ? `${decision.item.target.name} (${decision.item.target.email})` : 'Organisation'}</Label><Label>Requested by: {decision.item.requested_by.name} ({decision.item.requested_by.email})</Label><Label>Requested: {new Date(decision.item.created_at).toLocaleString()}</Label><Label>Expires: {new Date(decision.item.expires_at).toLocaleString()}</Label>{!!decision.item.reason && <Label>Reason: {decision.item.reason}</Label>}<Label>{approvalConsequence(decision.item, decision.choice)}</Label></>}<Label>The server will recheck your authority and enforce the two-person rule.</Label><Button title="Confirm decision" disabled={busy} onPress={() => { if (!decision) return; void op.run(async () => { const current = (await admin.listApprovals(status)).find(v => v.id === decision.item.id); if (!current || !(decision.choice === 'cancel' ? current.can.cancel : current.can.decide)) throw Error('This approval can no longer be changed.'); if (current.kind !== decision.item.kind || current.target?.id !== decision.item.target?.id || current.target?.email !== decision.item.target?.email || current.requested_by.id !== decision.item.requested_by.id || current.expires_at !== decision.item.expires_at) throw Error('This approval changed. Close and review the current request.'); return admin.decideApproval(decision.item.id, decision.choice) }, () => { setDecision(null); resource.refresh() }) }} /><Button title="Go back" disabled={busy} onPress={() => setDecision(null)} /></Sheet>
  </View>
}
export function AdminPanel({ initialTab, initialUser }: { initialTab?: string; initialUser?: string }) {
  const { me } = useSession(); const [tab, setTab] = useState<'people' | 'companies' | 'groups' | 'approvals' | 'security'>(initialTab === 'companies' || initialTab === 'groups' || initialTab === 'approvals' || initialTab === 'security' ? initialTab : 'people')
  const managesUsers = me?.capabilities.includes('ADMIN_USERS') ?? false
  if (!managesUsers && !me?.capabilities.includes('ADMIN_AUDIT')) return <Label>Administration access is not enabled for your account.</Label>
  const currentTab = managesUsers ? tab : 'groups'
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Label large>Administration</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(managesUsers ? ['people', 'companies', 'groups', 'approvals', 'security'] as const : ['groups'] as const).map(value => <Button key={value} title={`${value}${tab === value ? ' selected' : ''}`} onPress={() => setTab(value)} />)}</View>
    {currentTab === 'people' ? <People initialUser={initialUser} /> : currentTab === 'companies' ? <Companies /> : currentTab === 'groups' ? <Groups /> : currentTab === 'security' ? <SecurityPolicyPanel /> : <Approvals />}
  </ScrollView>
}
