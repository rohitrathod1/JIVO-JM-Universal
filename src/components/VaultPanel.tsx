import { SecretCopy } from './SecretCopy'
import { VaultWorkspace, TeamVaults, EmergencyAccess } from './VaultManagement'
import { useCallback, useEffect, useRef, useState } from 'react'
import { randomUUID } from 'expo-crypto'
import { ActivityIndicator, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import * as vault from '../modules/passwords/api'
import { useSession } from '../core/auth/Session'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { customSecretFields } from '../modules/passwords/secretInput'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { useCursor } from '../shared/useCursor'
import { Button, Card, Field, Label, styles, useColors } from '../ui'
import { EntryAccess, FolderManager } from './VaultTools'
import { Sheet } from './Sheet'
import { PasswordGenerator } from './PasswordGenerator'
function EntryEditor({ entry, vaultId, onClose, onSaved }: { entry?: vault.Entry; vaultId: string; onClose: () => void; onSaved: () => void }) {
  const c = useColors(); const [title, setTitle] = useState(entry?.title ?? ''); const [username, setUsername] = useState(entry?.username ?? ''); const [url, setUrl] = useState(entry?.url ?? '')
  const [kind, setKind] = useState<vault.EntryKind>(entry?.kind ?? 'login'); const [tags, setTags] = useState(entry?.tags.join(', ') ?? '')
  const [password, setPassword] = useState(''); const [notes, setNotes] = useState(''); const [custom, setCustom] = useState<{ id: string; name: string; value: string }[]>([])
  const [showPassword, setShowPassword] = useState(false); const [showGenerator, setShowGenerator] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [removeFields, setRemoveFields] = useState<string[]>([])
  const [existingFields, setExistingFields] = useState<string[]>([])
  useEffect(() => { let active = true; if (entry) vault.getEntry(entry.id).then(value => { if (active) setExistingFields(value.secret_fields?.filter(f => !['password', 'notes', 'totp', 'totp_seed'].includes(f)) ?? []) }).catch(() => {}); return () => { active = false } }, [entry])
  const requestId = useRef(randomUUID())
  useEffect(() => { requestId.current = randomUUID() }, [title, username, url, kind, tags, password, notes, custom, removeFields])
  useEffect(() => subscribeSensitiveView(active => { if (!active) { setPassword(''); setNotes(''); setCustom([]); onClose() } }), [onClose])
  async function save() {
    if (busy || !title.trim()) return
    setBusy(true); setError('')
    try {
      if (custom.some(field => !field.name.trim()) || new Set(custom.map(field => field.name.trim())).size !== custom.length) throw new Error('Give each custom field a unique name.')
      const fields = customSecretFields(custom, removeFields)
      const secret = { ...(password ? { password } : {}), ...(notes ? { notes } : {}), ...(fields ? { fields: fields as Record<string, string | null> } : {}) }
      const data: vault.EntryInput = { kind, title: title.trim(), username, url, tags: tags.split(',').map(t => t.trim()).filter(Boolean), folder: entry?.folder ?? null, ...(!entry ? { vault: vaultId } : {}), ...(Object.keys(secret).length ? { secret } : {}) }
      if (entry) await vault.updateEntry(entry.id, data); else await vault.createEntry(data, requestId.current)
      setPassword(''); setNotes(''); setCustom([]); onSaved()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>{entry ? 'Edit entry' : 'New entry'}</Label>
    <Field label="Entry title" value={title} onChangeText={setTitle} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['login', 'api_key', 'note', 'card', 'server', 'wifi', 'other'] as const).map(value => <Button key={value} title={`${value}${kind === value ? ' selected' : ''}`} onPress={() => setKind(value)} />)}</View>
    <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" /><Field label="Website" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" /><Field label="Tags (comma separated)" value={tags} onChangeText={setTags} />
    <Label>{entry ? 'Leave secret fields blank to preserve their existing values.' : 'Secret values are submitted directly and kept only in this form until it closes.'}</Label>
    <Field label="Secret password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} autoComplete="off" autoCorrect={false} autoCapitalize="none" />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button title={showPassword ? 'Hide password' : 'Show password'} variant="ghost" disabled={busy} onPress={() => setShowPassword(value => !value)} /><Button title="Password generator" variant="secondary" disabled={busy} onPress={() => setShowGenerator(value => !value)} /></View>
    {showGenerator && <PasswordGenerator onPick={value => { setPassword(value); setShowPassword(true) }} disabled={busy} />}
    <Field label="Secret notes" secureTextEntry value={notes} onChangeText={setNotes} autoComplete="off" />
    {existingFields.map(name => <Button key={name} title={(removeFields.includes(name) ? 'Undo removal: ' : 'Remove stored field: ') + name} onPress={() => setRemoveFields(fields => fields.includes(name) ? fields.filter(f => f !== name) : [...fields, name])} />)}
    {custom.map((field, index) => <Card key={field.id}><Field label={`Custom field ${index + 1} name`} value={field.name} onChangeText={value => setCustom(items => items.map(item => item.id === field.id ? { ...item, name: value } : item))} /><Field label={`Custom field ${index + 1} value`} secureTextEntry autoComplete="off" value={field.value} onChangeText={value => setCustom(items => items.map(item => item.id === field.id ? { ...item, value } : item))} /><Button title={`Remove custom field ${index + 1}`} onPress={() => setCustom(items => items.filter(item => item.id !== field.id))} /></Card>)}
    <Button title="Add custom secret field" onPress={() => setCustom(items => [...items, { id: randomUUID(), name: '', value: '' }])} />
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}<Button title="Save entry" disabled={busy || !title.trim()} onPress={() => void save()} /><Button title="Cancel entry" disabled={busy} onPress={onClose} />
  </Sheet>
}
function EntryDetails({ entry, onClose, onChanged }: { entry: vault.Entry; onClose: () => void; onChanged: () => void }) {
  const c = useColors(); const [detail, setDetail] = useState<vault.EntryDetail | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [secret, setSecret] = useState<{ field: string; value: string } | null>(null); const [confirmTrash, setConfirmTrash] = useState(false)
  const secretGeneration = useRef(0); const foreground = useRef(true); const expiry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clear = useCallback(() => { secretGeneration.current++; if (expiry.current) clearTimeout(expiry.current); setSecret(null) }, [])
  useEffect(() => { let active = true; vault.getEntry(entry.id).then(value => { if (active) setDetail(value) }).catch(e => { if (active) setError(errorMessage(e)) }); return () => { active = false; clear() } }, [entry.id, clear])
  useEffect(() => subscribeSensitiveView(active => { foreground.current = active; if (!active) clear() }), [clear])
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); try { await action() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  async function reveal(field: string, version?: number) {
    clear(); const generation = secretGeneration.current
    await run(async () => { const value = await vault.revealField(entry.id, field, version); if (generation !== secretGeneration.current || !foreground.current) return
      setSecret({ field, value: value.value }); expiry.current = setTimeout(clear, Math.max(0, Math.min(value.expires_in, 30)) * 1000)
    })
  }
  return <Sheet visible onClose={() => { clear(); onClose() }}><Label large>{entry.title}</Label><Label>{entry.username}</Label><Label>{entry.url}</Label><Label>{entry.tags.join(', ')}</Label>
    {!detail && !error && <ActivityIndicator />}{detail?.can.reveal && <>{detail.secret_fields === null ? <Button title="Unlock secret fields" disabled={busy} onPress={() => void run(async () => { await vault.unlock(); setDetail(await vault.getEntry(entry.id)) })} /> : detail.secret_fields.map(field => <Button key={field} title={`Reveal ${field}`} disabled={busy} onPress={() => void reveal(field)} />)}</>}
    {secret && <Card><Label>{secret.field}</Label><Text selectable style={{ color: c.text }}>{secret.value}</Text><Label>Hidden automatically within 30 seconds or when the app leaves the foreground.</Label><SecretCopy key={entry.id+secret.field} entryId={entry.id} field={secret.field} value={secret.value}/><Button title="Hide secret" onPress={clear} /></Card>}
    {detail?.can.history && <><Label large>Version history</Label>{detail.versions.map(v => <View key={v.version} style={{ gap: 8 }}><Label>Version {v.version} · {v.current ? 'Current' : v.shredded ? 'Shredded' : 'Previous'} · {new Date(v.created_at).toLocaleString()}</Label>{!v.current && !v.shredded && detail.can.reveal && detail.secret_fields?.map(field => <Button key={field} title={`Reveal ${field} from version ${v.version}`} disabled={busy} onPress={() => void reveal(field, v.version)} />)}</View>)}</>}
    {detail && <EntryAccess entry={detail} onRefresh={async () => { clear(); setDetail(await vault.getEntry(entry.id)) }} onMoved={() => { clear(); onChanged() }} />}
    {detail?.can.delete && !entry.trashed_at && (confirmTrash ? <><Label>Move this entry to trash?</Label><Button title="Confirm trash" disabled={busy} onPress={() => void run(async () => { clear(); await vault.trashEntry(entry.id); onChanged() })} /></> : <Button title="Move to trash" disabled={busy} onPress={() => setConfirmTrash(true)} />)}
    {entry.trashed_at && detail?.can.edit && <Button title="Restore entry" disabled={busy} onPress={() => void run(async () => { await vault.restoreEntry(entry.id); onChanged() })} />}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}<Button title="Close entry" onPress={() => { clear(); onClose() }} />
  </Sheet>
}
function VaultEntries({ selected }: { selected: vault.Vault }) {
  const c = useColors(); const [query, setQuery] = useState(''); const [folder, setFolder] = useState<string | undefined>(); const [folders, setFolders] = useState<vault.Folder[]>([])
  const [manageFolders, setManageFolders] = useState(false)
  const [trash, setTrash] = useState(false); const [editor, setEditor] = useState<vault.Entry | 'new' | null>(null); const [detail, setDetail] = useState<vault.Entry | null>(null)
  const load = useCallback((cursor?: string | null) => vault.listEntries({ vault: selected.id, q: query || undefined, folder, trashed: trash ? '1' : undefined, cursor: cursor ?? undefined }), [selected.id, query, folder, trash]); const page = useCursor(load)
  useEffect(() => { let active = true; vault.listFolders(selected.id).then(value => { if (active) setFolders(value) }).catch(() => {}); return () => { active = false } }, [selected.id])
  const closeEditor = useCallback(() => setEditor(null), [])
  return <View style={{ gap: 14 }}><Label large>{selected.name}</Label><Label>{selected.description}</Label><Field label="Search entries" value={query} onChangeText={setQuery} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button title="All folders" onPress={() => setFolder(undefined)} />{folders.map(f => <Button key={f.id} title={`${f.name}${folder === f.id ? ' selected' : ''}`} onPress={() => setFolder(f.id)} />)}<Button title={trash ? 'Show active entries' : 'Show trash'} onPress={() => setTrash(v => !v)} /></View>
    {selected.can.edit_folders && <Button title="Manage folders" onPress={() => setManageFolders(true)} />}
    {manageFolders && <FolderManager vaultId={selected.id} folders={folders} onClose={() => setManageFolders(false)} onChanged={async () => { setFolders(await vault.listFolders(selected.id)); setFolder(undefined); void page.refresh() }} />}
    {selected.can.create_entry && !trash && <Button title="Create entry" onPress={() => setEditor('new')} />}
    {!!page.error && <Text accessibilityRole="alert" style={{ color: c.text }}>{page.error}</Text>}
    {page.items.map(entry => <Card key={entry.id}><Label large>{entry.title}</Label><Label>{entry.username} · {entry.kind}</Label><Button title={`Open ${entry.title}`} onPress={() => setDetail(entry)} />{entry.can.edit && !entry.trashed_at && <Button title={`Edit ${entry.title}`} onPress={() => setEditor(entry)} />}</Card>)}
    {page.loading && <ActivityIndicator />}{!page.loading && !page.items.length && <Label>No entries match these filters.</Label>}{page.cursor && <Button title="More entries" disabled={page.loading} onPress={() => void page.more()} />}
    {editor && <EntryEditor entry={editor === 'new' ? undefined : editor} vaultId={selected.id} onClose={closeEditor} onSaved={() => { setEditor(null); void page.refresh() }} />}
    {detail && <EntryDetails entry={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); void page.refresh() }} />}
  </View>
}
function SharedEntries() {
  const c = useColors(); const resource = useResource(vault.listShared); const [selected, setSelected] = useState<vault.Entry | null>(null)
  return <View style={{ gap: 12 }}><Label large>Shared with me</Label>{resource.loading && <ActivityIndicator />}{!!resource.error && <Text accessibilityRole="alert" style={{ color: c.text }}>{errorMessage(resource.error)}</Text>}{resource.value?.map(entry => <Card key={entry.id}><Label large>{entry.title}</Label><Label>{entry.vault.name} · Shared by {entry.share.granted_by.name}</Label><Button title={`Open shared entry ${entry.title}`} onPress={() => setSelected(entry)} /></Card>)}{!resource.loading && !resource.value?.length && <Label>No entries are shared with you.</Label>}{selected && <EntryDetails entry={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); resource.refresh() }} />}</View>
}
export function VaultPanel({ initialVault, initialEntry, initialView }: { initialVault?: string; initialEntry?: string; initialView?: string }) {
  const [section, setSection] = useState(initialView === 'admin' || initialView === 'break-glass' ? initialView : 'vaults')
  const [linkedEntry, setLinkedEntry] = useState<vault.Entry | null>(null)
  const [shared, setShared] = useState(initialView === 'shared')
  const { me } = useSession(); const c = useColors(); const { width } = useWindowDimensions(); const [items, setItems] = useState<vault.Vault[]>([]); const [selected, setSelected] = useState<vault.Vault | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  useEffect(() => { if (!me?.capabilities.includes('JP_ACCESS')) return; let active = true; vault.listVaults().then(values => { if (active) { setItems(values); if (initialVault) { const found = values.find(v => v.id === initialVault); if (found) setSelected(found); else void vault.getVault(initialVault).then(v => { if (active) setSelected(v) }).catch(e => { if (active) setError(errorMessage(e)) }) } } }).catch(e => { if (active) setError(errorMessage(e)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [me?.capabilities, initialVault])
  useEffect(() => { let active = true; if (initialEntry && me?.capabilities.includes('JP_ACCESS')) vault.getEntry(initialEntry).then(value => { if (active) setLinkedEntry(value) }).catch(e => { if (active) setError(errorMessage(e)) }); return () => { active = false } }, [initialEntry, me?.capabilities])
  if (!me || !me.capabilities.includes('JP_ACCESS') && !(section === 'admin' && me.capabilities.includes('JP_MANAGE_VAULT')) && !(section === 'break-glass' && me.capabilities.some(c => ['JP_BREAK_GLASS','JP_REQUEST_EMERGENCY'].includes(c)))) return <Label>Passwords access is not enabled for your account.</Label>
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Label large>Passwords</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button title={shared ? 'My vaults' : 'My vaults selected'} onPress={() => { setSection('vaults'); setShared(false) }} /><Button title={shared ? 'Shared with me selected' : 'Shared with me'} onPress={() => { setSection('vaults'); setShared(true) }} />{me!.capabilities.includes('JP_MANAGE_VAULT') && <Button title="Team vaults" onPress={() => setSection('admin')} />}{me.capabilities.some(c => ['JP_BREAK_GLASS','JP_REQUEST_EMERGENCY'].includes(c)) && <Button title="Emergency access" onPress={() => setSection('break-glass')} />}</View>{loading && me?.capabilities.includes('JP_ACCESS') && <ActivityIndicator />}{!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}
    {linkedEntry && <EntryDetails entry={linkedEntry} onClose={() => setLinkedEntry(null)} onChanged={() => setLinkedEntry(null)} />}
    {section === 'admin' ? me!.capabilities.includes('JP_MANAGE_VAULT') ? <TeamVaults /> : <Label>Team vault administration is not enabled.</Label> : section === 'break-glass' ? me.capabilities.some(c => ['JP_BREAK_GLASS','JP_REQUEST_EMERGENCY'].includes(c)) ? <EmergencyAccess onOpen={id => { void vault.getVault(id).then(value => { setSelected(value); setSection('vaults'); setShared(false) }).catch(e => setError(errorMessage(e))) }} /> : <Label>Emergency access is not enabled.</Label> : shared ? <><View style={{ gap: 10 }}>{items.filter(v => !v.mine).map(v => <Button key={v.id} title={`Open shared vault ${v.name}`} onPress={() => { setSelected(v); setShared(false) }} />)}</View><SharedEntries /></> : <View style={{ flexDirection: width >= 1000 ? 'row' : 'column', gap: 20 }}><View style={{ width: width >= 1000 ? 280 : '100%', gap: 12 }}>{items.map(item => <Card key={item.id}><Label large>{item.name}</Label><Label>{item.entry_count} entries · {item.my_role}</Label><Button title={`Open vault ${item.name}`} onPress={() => setSelected(item)} /></Card>)}</View><View style={{ flex: 1, minWidth: 0 }}>{selected ? <VaultWorkspace key={selected.id} selected={selected} initialView={initialView} onChanged={value => { setSelected(value); setItems(rows => rows.map(v => v.id === value.id ? value : v)) }}><VaultEntries selected={selected} /></VaultWorkspace> : <Label>Select a vault to view its entries.</Label>}</View></View>}
  </ScrollView>
}


