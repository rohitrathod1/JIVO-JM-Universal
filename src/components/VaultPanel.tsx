import { PasswordField } from './PasswordField'
import { SecretCopy } from './SecretCopy'
import { VaultWorkspace, TeamVaults, EmergencyAccess } from './VaultManagement'
import { useCallback, useEffect, useRef, useState } from 'react'
import { randomUUID } from 'expo-crypto'
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type PressableStateCallbackType, type ViewStyle } from 'react-native'
import * as vault from '../modules/passwords/api'
import { useSession } from '../core/auth/Session'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { customSecretFields } from '../modules/passwords/secretInput'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { useCursor } from '../shared/useCursor'
import { ColorOverrides, Button, EmptyState, Field, Label, Spinner, Surface, styles, useColors } from '../ui'
import { Badge, Muted, PageHeader, RowButton, SearchInput, Select, ToolButton, dateLabel, font, relative } from './InboxVaultKit'
import { Icon } from './Icon'
import { EntryAccess, FolderManager } from './VaultTools'
import { VaultSheet as Sheet } from './VaultSheet'
import { PasswordGenerator } from './PasswordGenerator'
function EntryEditor({ entry, vaultId, onClose, onSaved }: { entry?: vault.Entry; vaultId: string; onClose: () => void; onSaved: () => void }) {
  const c = useColors(); const [title, setTitle] = useState(entry?.title ?? ''); const [username, setUsername] = useState(entry?.username ?? ''); const [url, setUrl] = useState(entry?.url ?? '')
  const [kind, setKind] = useState<vault.EntryKind>(entry?.kind ?? 'login'); const [tags, setTags] = useState(entry?.tags.join(', ') ?? '')
  const [password, setPassword] = useState(''); const [notes, setNotes] = useState(''); const [custom, setCustom] = useState<{ id: string; name: string; value: string }[]>([])
  const [showGenerator, setShowGenerator] = useState(false)
  const [folder, setFolder] = useState(entry?.folder ?? '')
  const loadFolders = useCallback(() => vault.listFolders(vaultId), [vaultId]); const folders = useResource(loadFolders)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [removeFields, setRemoveFields] = useState<string[]>([])
  const [existingFields, setExistingFields] = useState<string[]>([])
  useEffect(() => { let active = true; if (entry) vault.getEntry(entry.id).then(value => { if (active) setExistingFields(value.secret_fields?.filter(f => !['password', 'notes', 'totp', 'totp_seed'].includes(f)) ?? []) }).catch(() => {}); return () => { active = false } }, [entry])
  const requestId = useRef(randomUUID())
  useEffect(() => { requestId.current = randomUUID() }, [title, username, url, kind, tags, password, notes, custom, removeFields, folder])
  useEffect(() => subscribeSensitiveView(active => { if (!active) { setPassword(''); setNotes(''); setCustom([]); onClose() } }), [onClose])
  async function save() {
    if (busy || !title.trim()) return
    setBusy(true); setError('')
    try {
      if (custom.some(field => !field.name.trim()) || new Set(custom.map(field => field.name.trim())).size !== custom.length) throw new Error('Give each custom field a unique name.')
      const fields = customSecretFields(custom, removeFields)
      const secret = { ...(password ? { password } : {}), ...(notes ? { notes } : {}), ...(fields ? { fields: fields as Record<string, string | null> } : {}) }
      const data: vault.EntryInput = { kind, title: title.trim(), username, url, tags: tags.split(',').map(t => t.trim()).filter(Boolean), folder: folder || null, ...(!entry ? { vault: vaultId } : {}), ...(Object.keys(secret).length ? { secret } : {}) }
      if (entry) await vault.updateEntry(entry.id, data); else await vault.createEntry(data, requestId.current)
      setPassword(''); setNotes(''); setCustom([]); onSaved()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const inputStyle = { minHeight: 40, height: 40, fontSize: 14, paddingVertical: 8, paddingHorizontal: 12 }
  return <Sheet visible title={entry ? `Edit ${entry.title}` : 'New entry'} wide closeDisabled={busy} onClose={onClose}
    footer={<><Button title="Cancel" size="sm" variant="secondary" disabled={busy} onPress={onClose} /><Button title="Save" size="sm" loading={busy} disabled={busy || !title.trim()} onPress={() => void save()} /></>}>
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6, zIndex: 30 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Type</Text><Select height={40} label="Type" value={kind} onChange={setKind} options={(['login', 'api_key', 'server', 'wifi', 'card', 'note', 'other'] as const).map(value => ({ value, label: KIND_LABEL[value] }))} /></View>
      <Field inset={false} style={inputStyle} label="Title" value={title} onChangeText={setTitle} maxLength={200} />
      <Field inset={false} style={inputStyle} label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <Field inset={false} style={inputStyle} label="Address (URL)" placeholder="https://" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      <View style={{ gap: 6, zIndex: 20 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Folder</Text><Select height={40} label="Folder" value={folder} onChange={setFolder} options={[{ value: '', label: 'No folder' }, ...(folders.value ?? []).map(f => ({ value: f.id, label: f.name }))]} /></View>
      <Field inset={false} style={inputStyle} label="Tags" hint="Separate with commas." value={tags} onChangeText={setTags} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}><View style={{ flex: 1 }}><PasswordField inset={false} style={inputStyle} label="Password" value={password} onChangeText={setPassword} autoComplete="off" /></View><ToolButton iconOnly icon="wand2" label="Password generator" height={40} disabled={busy} onPress={() => setShowGenerator(value => !value)} /></View>
      {entry && <Muted>Leave empty to keep the stored value.</Muted>}
      {showGenerator && <PasswordGenerator onPick={setPassword} disabled={busy} />}
      <Field inset={false} style={{ ...inputStyle, height: 84 }} multiline label="Notes" value={notes} onChangeText={setNotes} autoComplete="off" hint={entry ? 'Leave empty to keep the stored value.' : undefined} />
      <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Other secret fields</Text>
      {existingFields.map(name => <Button key={name} size="sm" variant="ghost" title={(removeFields.includes(name) ? 'Undo removal: ' : 'Remove ') + name} onPress={() => setRemoveFields(fields => fields.includes(name) ? fields.filter(f => f !== name) : [...fields, name])} />)}
      {custom.map((field, index) => <View key={field.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><View style={{ flex: 1 }}><Field compact inset={false} style={inputStyle} label={`Field ${index + 1} name`} placeholder="Name (e.g. PIN)" value={field.name} onChangeText={value => setCustom(items => items.map(item => item.id === field.id ? { ...item, name: value } : item))} /></View><View style={{ flex: 1 }}><PasswordField compact inset={false} style={inputStyle} label={`Field ${index + 1} value`} placeholder="Value" value={field.value} onChangeText={value => setCustom(items => items.map(item => item.id === field.id ? { ...item, value } : item))} /></View><ToolButton iconOnly variant="ghost" icon="trash2" label="Remove field" onPress={() => setCustom(items => items.filter(item => item.id !== field.id))} /></View>)}
      <View style={{ alignSelf: 'flex-start' }}><ToolButton variant="ghost" icon="plus" label="Add field" onPress={() => setCustom(items => [...items, { id: randomUUID(), name: '', value: '' }])} /></View>
      {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}
    </View>
  </Sheet>
}
function EyeButton({ icon, label, busy, onPress }: { icon: 'eye' | 'eyeOff'; label: string; busy: boolean; onPress: () => void }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onPress} style={({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => [{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? c.hover : 'transparent', opacity: busy ? 0.5 : 1 }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : {}]}><Icon name={icon} size={16} color={c.text} /></Pressable>
}

function EntryDetails({ entry, onClose, onChanged }: { entry: vault.Entry; onClose: () => void; onChanged: () => void }) {
  const c = useColors(); const [detail, setDetail] = useState<vault.EntryDetail | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [secret, setSecret] = useState<{ field: string; value: string; version?: number } | null>(null); const [confirmTrash, setConfirmTrash] = useState(false)
  const secretGeneration = useRef(0); const foreground = useRef(true); const expiry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clear = useCallback(() => { secretGeneration.current++; if (expiry.current) clearTimeout(expiry.current); setSecret(null) }, [])
  useEffect(() => { let active = true; vault.getEntry(entry.id).then(value => { if (active) setDetail(value) }).catch(e => { if (active) setError(errorMessage(e)) }); return () => { active = false; clear() } }, [entry.id, clear])
  useEffect(() => subscribeSensitiveView(active => { foreground.current = active; if (!active) clear() }), [clear])
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); try { await action() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  async function reveal(field: string, version?: number) {
    clear(); const generation = secretGeneration.current
    await run(async () => { const value = await vault.revealField(entry.id, field, version); if (generation !== secretGeneration.current || !foreground.current) return
      setSecret({ field, value: value.value, version }); expiry.current = setTimeout(clear, Math.max(0, Math.min(value.expires_in, 30)) * 1000)
    })
  }
  const mono = Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' })
  const close = () => { clear(); onClose() }
  const kv = (label: string, value: React.ReactNode) => <View style={{ gap: 4, marginBottom: 12 }}><Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.muted }}>{label}</Text><View style={{ flex: 1, minWidth: 0 }}>{value}</View></View>
  const plain = (value: string, monospace = false) => <Text selectable numberOfLines={1} style={{ fontFamily: monospace ? mono : font.r, fontSize: 14, lineHeight: 20, color: c.text }}>{value || '—'}</Text>
  const fields = detail?.secret_fields ?? []
  return <Sheet visible onClose={close}>
    <View style={{ gap: 2 }}>
      <Text accessibilityRole="header" style={{ fontFamily: font.s, fontWeight: '600', fontSize: 20, lineHeight: 28, letterSpacing: -0.3, color: c.text }}>{entry.title}</Text>
      <Text style={{ fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.muted }}>{KIND_LABEL[entry.kind] ?? entry.kind} in <Text style={{ color: c.primary }}>{entry.vault.name}</Text></Text>
    </View>
    <Surface style={{ padding: 20, gap: 0 }}>
      {kv('Username', plain(entry.username, true))}
      {kv('Address', entry.url ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text selectable numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.primary }}>{entry.url}</Text><Icon name="externalLink" size={12} color={c.primary} /></View> : plain(''))}
      {kv('Tags', entry.tags.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{entry.tags.map(t => <Badge key={t}>{t}</Badge>)}</View> : plain(''))}
      {kv('Password changed', plain(entry.password_changed_at ? dateLabel(entry.password_changed_at) : ''))}
      {!detail && !error && <View style={{ paddingVertical: 16 }}><ActivityIndicator color={c.brand} /></View>}
      {detail?.can.reveal && detail.secret_fields === null && <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, alignItems: 'flex-start' }}><ToolButton icon="lockKeyhole" label="Unlock secret fields" disabled={busy} onPress={() => void run(async () => { await vault.unlock(); setDetail(await vault.getEntry(entry.id)) })} /></View>}
      {detail?.can.reveal && fields.map(field => { const shown = secret?.field === field && secret.version === undefined ? secret : null
        return <View key={field} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontFamily: font.r, fontSize: 12, lineHeight: 16, color: c.muted }}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
              {shown ? <Text selectable style={{ fontFamily: mono, fontSize: 14, lineHeight: 20, color: c.text }}>{shown.value}</Text> : <Text style={{ fontFamily: mono, fontSize: 14, lineHeight: 20, letterSpacing: 2, color: c.text }}>{'•••••••••••'}</Text>}</View>
            {shown ? <EyeButton icon="eyeOff" label="Hide secret" busy={busy} onPress={clear} /> : <EyeButton icon="eye" label={`Reveal ${field}`} busy={busy} onPress={() => void reveal(field)} />}
          </View>
          {shown && <><SecretCopy key={entry.id + field} entryId={entry.id} field={field} value={shown.value} /><Muted>Hidden automatically within 30 seconds or when the app leaves the foreground.</Muted></>}
        </View> })}
    </Surface>
    {detail?.can.history && <Surface style={{ padding: 20, gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontFamily: font.s, fontWeight: '600', fontSize: 16, lineHeight: 24, color: c.text }}>Versions</Text>
      {detail.versions.map(v => <View key={v.version} style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.text }}>Version {v.version}</Text>{v.current ? <Badge tone="brand">current</Badge> : v.shredded ? <Badge tone="danger">shredded</Badge> : null}</View>
        <Muted>{[v.created_by?.name, dateLabel(v.created_at, true)].filter(Boolean).join(', ')}</Muted>
        {!v.current && !v.shredded && detail.can.reveal && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{fields.map(field => <ToolButton key={field} variant="ghost" muted={false} icon="eye" height={32} label={`Reveal ${field}`} a11y={`Reveal ${field} from version ${v.version}`} disabled={busy} onPress={() => void reveal(field, v.version)} />)}</View>}
        {secret && secret.version === v.version && <View style={{ gap: 4, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 12 }}><Text style={{ fontFamily: font.r, fontSize: 12, lineHeight: 16, color: c.muted }}>{secret.field}</Text><Text selectable style={{ fontFamily: mono, fontSize: 14, lineHeight: 20, color: c.text }}>{secret.value}</Text><SecretCopy key={entry.id + secret.field + v.version} entryId={entry.id} field={secret.field} value={secret.value} /><View style={{ alignSelf: 'flex-start' }}><ToolButton variant="ghost" muted={false} icon="eyeOff" height={32} label="Hide" a11y="Hide secret" onPress={clear} /></View></View>}
      </View>)}
    </Surface>}
    {detail && <EntryAccess entry={detail} onRefresh={async () => { clear(); setDetail(await vault.getEntry(entry.id)) }} onMoved={() => { clear(); onChanged() }} />}
    {confirmTrash && <Muted size={14}>Move this entry to trash?</Muted>}
    {!!error && <Text accessibilityRole="alert" style={{ fontFamily: font.r, fontSize: 14, color: c.danger }}>{error}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
      {detail?.can.delete && !entry.trashed_at && (confirmTrash ? <ToolButton danger icon="trash2" label="Confirm trash" disabled={busy} onPress={() => void run(async () => { clear(); await vault.trashEntry(entry.id); onChanged() })} /> : <ToolButton iconOnly icon="trash2" label="Trash" a11y="Move to trash" disabled={busy} onPress={() => setConfirmTrash(true)} />)}
      {entry.trashed_at && detail?.can.edit && <ToolButton icon="rotateCcw" label="Restore entry" disabled={busy} onPress={() => void run(async () => { await vault.restoreEntry(entry.id); onChanged() })} />}
      <ToolButton label="Close" a11y="Close entry" onPress={close} />
    </View>
  </Sheet>
}
function VaultEntries({ selected, trash = false }: { selected: vault.Vault; trash?: boolean }) {
  const c = useColors(); const { width } = useWindowDimensions(); const [query, setQuery] = useState(''); const [folder, setFolder] = useState<string | undefined>(); const [folders, setFolders] = useState<vault.Folder[]>([])
  const [manageFolders, setManageFolders] = useState(false)
  const [editor, setEditor] = useState<vault.Entry | 'new' | null>(null); const [detail, setDetail] = useState<vault.Entry | null>(null)
  const load = useCallback((cursor?: string | null) => vault.listEntries({ vault: selected.id, q: query || undefined, folder, trashed: trash ? '1' : undefined, cursor: cursor ?? undefined }), [selected.id, query, folder, trash]); const page = useCursor(load)
  useEffect(() => { let active = true; vault.listFolders(selected.id).then(value => { if (active) setFolders(value) }).catch(() => {}); return () => { active = false } }, [selected.id])
  const closeEditor = useCallback(() => setEditor(null), [])
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, zIndex: 10 }}>
      <SearchInput label="Search entries" value={query} onChangeText={setQuery} placeholder="Search titles, usernames, addresses, tags" style={{ flexGrow: 1, flexBasis: '100%', minWidth: 0 }} />
      {!trash && <Select label="Folder" height={40} value={folder ?? ''} onChange={value => setFolder(value || undefined)} style={{ flexGrow: 1, flexBasis: 140, maxWidth: 176 }} options={[{ value: '', label: 'All folders' }, ...folders.map(f => ({ value: f.id, label: f.name }))]} />}
      {selected.can.edit_folders && !trash && <ToolButton icon="folderPlus" iconOnly label="New folder" height={40} onPress={() => setManageFolders(true)} />}
      {selected.can.create_entry && !trash && <ToolButton variant="primary" icon="plus" label="New entry" a11y="Create entry" height={40} onPress={() => setEditor('new')} />}
    </View>
    {manageFolders && <FolderManager vaultId={selected.id} folders={folders} onClose={() => setManageFolders(false)} onChanged={async () => { setFolders(await vault.listFolders(selected.id)); setFolder(undefined); void page.refresh() }} />}
    {!!page.error && <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: font.r, fontSize: 14 }}>{page.error}</Text>}
    <Surface>
      {page.loading && !page.items.length && <View style={{ padding: 24 }}><Spinner /></View>}
      {!page.loading && !page.items.length && <EmptyState title={trash ? 'The trash is empty.' : query ? 'Nothing matches.' : 'No entries yet.'} description={trash ? 'Entries stay here for 30 days, then they are destroyed for good.' : undefined} />}
      {page.items.map((entry, i) => <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
        <RowButton label={`Open ${entry.title}`} style={{ flex: 1, minWidth: 0 }} onPress={() => setDetail(entry)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, lineHeight: 20, color: c.text }}>{entry.title}</Text>
              <Muted lines={1}>{[KIND_LABEL[entry.kind] ?? entry.kind, entry.username, entry.url].filter(Boolean).join(' · ')}</Muted>
            </View>
            {width >= 640 && entry.tags.slice(0, 3).map(t => <Badge key={t}>{t}</Badge>)}
            <Muted>{entry.trashed_at ? `Trashed ${relative(entry.trashed_at)}` : relative(entry.updated_at)}</Muted>
          </View>
        </RowButton>
        {entry.can.edit && !entry.trashed_at && <View style={{ paddingRight: 8 }}><ToolButton variant="ghost" muted={false} iconOnly icon="pencil" label="Edit" a11y={`Edit ${entry.title}`} height={32} onPress={() => setEditor(entry)} /></View>}
      </View>)}
      {page.cursor && <View style={{ alignItems: 'center', padding: 8 }}><Button variant="ghost" size="sm" title="More entries" disabled={page.loading} onPress={() => void page.more()} /></View>}
    </Surface>
    {editor && <EntryEditor entry={editor === 'new' ? undefined : editor} vaultId={selected.id} onClose={closeEditor} onSaved={() => { setEditor(null); void page.refresh() }} />}
    {detail && <EntryDetails entry={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); void page.refresh() }} />}
  </View>
}
const KIND_LABEL: Record<string, string> = { login: 'Login', api_key: 'API key', note: 'Secure note', card: 'Card', server: 'Server', wifi: 'Wi-Fi', other: 'Other' }
/** Reference VaultCard: Surface p-4, brand icon, bold name, muted owner and entry count, role badge. 1/2/3 columns. */
function VaultCard({ v, wide, label, onPress }: { v: vault.Vault; wide: number; label: string; onPress: () => void }) {
  const c = useColors(); const cols = wide >= 1280 ? 3 : wide >= 640 ? 2 : 1
  const basis = cols === 1 ? '100%' : cols === 2 ? '48%' : '31%'
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[{ flexGrow: 1, flexBasis: basis, maxWidth: cols === 1 ? '100%' : cols === 2 ? '50%' : '33.4%' }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}>
    <Surface style={{ padding: 16, flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ marginTop: 2 }}><Icon name={v.owner_type === 'personal' ? 'lock' : 'users'} size={20} color={c.brand} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.s, fontWeight: '600', fontSize: 15, lineHeight: 22, color: c.text }}>{v.owner_type === 'personal' ? 'My vault' : v.name}</Text>
          <Muted>{v.owner_type === 'company' ? v.company?.name : v.owner_type === 'shared' ? 'Team vault' : 'Only you'} · {v.entry_count} {v.entry_count === 1 ? 'entry' : 'entries'}</Muted>
        </View>
        {!!v.my_role && <Badge tone={v.my_role === 'owner' ? 'brand' : 'neutral'}>{v.my_role}</Badge>}
      </View>
      {!!(v.archived_at || v.break_glass_until || v.legal_hold) && <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{!!v.archived_at && <Badge>Archived</Badge>}{!!v.break_glass_until && <Badge tone="danger">Emergency access</Badge>}{!!v.legal_hold && <Badge tone="warning">Legal hold</Badge>}</View>}
    </Surface>
  </Pressable>
}
function SharedEntries({ hasVaults }: { hasVaults: boolean }) {
  const c = useColors(); const resource = useResource(vault.listShared); const [selected, setSelected] = useState<vault.Entry | null>(null)
  if (hasVaults && !resource.loading && !resource.error && !resource.value?.length) return null
  return <Surface>{resource.loading && <View style={{ padding: 24 }}><Spinner /></View>}{!!resource.error && <Text accessibilityRole="alert" style={{ color: c.danger, padding: 16 }}>{errorMessage(resource.error)}</Text>}
    {resource.value?.map((entry, i) => <RowButton key={entry.id} label={`Open shared entry ${entry.title}`} onPress={() => setSelected(entry)} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}><View style={{ paddingHorizontal: 12, paddingVertical: 10 }}><Text numberOfLines={1} style={{ fontFamily: font.m, fontWeight: '500', fontSize: 14, color: c.text }}>{entry.title}</Text><Muted lines={1}>{entry.vault.name} · Shared by {entry.share.granted_by.name}</Muted></View></RowButton>)}
    {!hasVaults && !resource.loading && !resource.error && !resource.value?.length && <EmptyState title="Nothing is shared with you." />}
    {selected && <EntryDetails entry={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); resource.refresh() }} />}</Surface>
}
function VaultPanelContent({ initialVault, initialEntry, initialView }: { initialVault?: string; initialEntry?: string; initialView?: string }) {
  const [section, setSection] = useState(initialView === 'admin' || initialView === 'break-glass' ? initialView : 'vaults')
  const [linkedEntry, setLinkedEntry] = useState<vault.Entry | null>(null)
  const [shared, setShared] = useState(initialView === 'shared')
  const { me } = useSession(); const c = useColors(); const { width } = useWindowDimensions(); const [items, setItems] = useState<vault.Vault[]>([]); const [selected, setSelected] = useState<vault.Vault | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  useEffect(() => { if (!me?.capabilities.includes('JP_ACCESS')) return; let active = true; vault.listVaults().then(values => { if (active) { setItems(values); if (initialVault) { const found = values.find(v => v.id === initialVault); if (found) setSelected(found); else void vault.getVault(initialVault).then(v => { if (active) setSelected(v) }).catch(e => { if (active) setError(errorMessage(e)) }) } } }).catch(e => { if (active) setError(errorMessage(e)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [me?.capabilities, initialVault])
  useEffect(() => { let active = true; if (initialEntry && me?.capabilities.includes('JP_ACCESS')) vault.getEntry(initialEntry).then(value => { if (active) setLinkedEntry(value) }).catch(e => { if (active) setError(errorMessage(e)) }); return () => { active = false } }, [initialEntry, me?.capabilities])
  if (!me || !me.capabilities.includes('JP_ACCESS') && !(section === 'admin' && me.capabilities.includes('JP_MANAGE_VAULT')) && !(section === 'break-glass' && me.capabilities.some(c => ['JP_BREAK_GLASS','JP_REQUEST_EMERGENCY'].includes(c)))) return <Label>Passwords access is not enabled for your account.</Label>
  const canAdmin = me.capabilities.includes('JP_MANAGE_VAULT'); const canEmergency = me.capabilities.some(c => ['JP_BREAK_GLASS', 'JP_REQUEST_EMERGENCY'].includes(c))
  const current = section === 'admin' ? 'admin' : section === 'break-glass' ? 'break-glass' : shared ? 'shared' : 'vaults'
  const inVault = current === 'vaults' ? selected : null
  const home = () => { setSection('vaults'); setShared(false); setSelected(null) }
  const header = current === 'shared' ? { title: 'Shared with me', subtitle: 'Vaults and entries other people shared with you.' } : current === 'admin' ? { title: 'Team vaults', subtitle: 'Create team vaults and appoint their owners.' } : current === 'break-glass' ? { title: 'Emergency access', subtitle: 'Temporary, approved access to a vault whose owners are unavailable.' } : inVault ? { title: inVault.owner_type === 'personal' ? 'My vault' : inVault.name, subtitle: `${inVault.owner_type === 'personal' ? 'Only you can see this vault' : inVault.owner_type === 'company' ? inVault.company?.name ?? 'Company vault' : 'Team vault'}${inVault.my_role ? ` · you are ${inVault.my_role}` : ''}` } : { title: 'Passwords', subtitle: 'Your vaults. Values stay encrypted until you reveal them.' }
  const crumbs = current === 'vaults' && !inVault ? undefined : [{ label: inVault?.mine === false ? 'Shared with me' : 'Passwords', onPress: inVault?.mine === false ? () => { setSelected(null); setShared(true) } : home }, { label: header.title }]
  const own = items.filter(v => v.mine !== false)
  const navigation = <Select height={40} style={{ flex: 1, minWidth: 0 }} label="Passwords sections" value={inVault?.mine === false ? 'shared' : current} onChange={value => { setSelected(null); if (value === 'shared') { setSection('vaults'); setShared(true) } else if (value === 'vaults') home(); else setSection(value) }}
      options={[{ value: 'vaults', label: 'Vaults' }, { value: 'shared', label: 'Shared with me' }, ...(canAdmin ? [{ value: 'admin' as const, label: 'Team vaults' }] : []), ...(canEmergency ? [{ value: 'break-glass' as const, label: 'Emergency access' }] : [])]} />
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { gap: 0 }]}>
    <PageHeader showMobileCrumbs title={header.title} subtitle={header.subtitle} crumbs={crumbs} />
    {!inVault && current !== 'admin' && current !== 'break-glass' && <View style={{ flexDirection: 'row', marginBottom: 16, zIndex: 30 }}>{navigation}</View>}
    {loading && me.capabilities.includes('JP_ACCESS') && <View style={{ padding: 24 }}><Spinner /></View>}{!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: font.r, fontSize: 14, marginBottom: 12 }}>{error}</Text>}
    {linkedEntry && <EntryDetails entry={linkedEntry} onClose={() => setLinkedEntry(null)} onChanged={() => setLinkedEntry(null)} />}
    {section === 'admin' ? canAdmin ? <TeamVaults navigation={navigation} /> : <EmptyState title="Team vault administration is not enabled." /> : section === 'break-glass' ? canEmergency ? <EmergencyAccess navigation={navigation} onOpen={id => { void vault.getVault(id).then(value => { setSelected(value); setSection('vaults'); setShared(false) }).catch(e => setError(errorMessage(e))) }} /> : <EmptyState title="Emergency access is not enabled." />
      : shared ? <View style={{ gap: 12 }}>{items.some(v => !v.mine) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{items.filter(v => !v.mine).map(v => <VaultCard key={v.id} v={v} wide={width} label={`Open shared vault ${v.name}`} onPress={() => { setSelected(v); setShared(false) }} />)}</View>}<SharedEntries hasVaults={items.some(v => !v.mine)} /></View>
      : selected ? <VaultWorkspace key={selected.id} selected={selected} navigation={navigation} initialView={initialView} onChanged={value => { setSelected(value); setItems(rows => rows.map(v => v.id === value.id ? value : v)) }}>{trash => <VaultEntries key={trash ? 'trash' : 'entries'} selected={selected} trash={trash} />}</VaultWorkspace>
      : <View style={{ gap: 12 }}>{!loading && !own.length && <Surface><EmptyState title="No vaults yet" description="Vaults and passwords people share with you are under Shared with me." /></Surface>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{own.map(item => <VaultCard key={item.id} v={item} wide={width} label={`Open vault ${item.name}`} onPress={() => setSelected(item)} />)}</View>
        {own.length > 0 && own.every(v => v.owner_type === 'personal') && <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="key" size={16} /><Muted size={14}>Team vaults other people add you to are under Shared with me.</Muted></View>}</View>}
  </ScrollView>
}



export function VaultPanel(props: Parameters<typeof VaultPanelContent>[0]) {
 const c = useColors()
 return <ColorOverrides.Provider value={c.dark ? { panel: '#101827', input: '#101c26', glass2: '#101827', glass3: '#101827', glass4: '#101827', neutral: '#243040' } : {}}><VaultPanelContent {...props} /></ColorOverrides.Provider>
}

