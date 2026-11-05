import { requireEntryPermission } from '../modules/passwords/permission'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import * as vault from '../modules/passwords/api'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { Button, Card, Field, Label, useColors } from '../ui'
import { ToolButton } from './InboxVaultKit'
import { VaultSheet as Sheet } from './VaultSheet'
export function EntryAccess({ entry, onRefresh, onMoved }: { entry: vault.EntryDetail; onRefresh: () => Promise<void>; onMoved: () => void }) {
  const c = useColors(); const [mode, setMode] = useState<'share' | 'move' | null>(null); const [query, setQuery] = useState(''); const [person, setPerson] = useState<vault.Person | null>(null); const [expires, setExpires] = useState('')
  const [target, setTarget] = useState<string | null>(null); const [folder, setFolder] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [revoke, setRevoke] = useState<vault.Share | null>(null)
  const loadPeople = useCallback(() => entry.can.share && mode === 'share' && query.trim() ? vault.searchPeople(query) : Promise.resolve([]), [entry.can.share, mode, query]); const people = useResource(loadPeople)
  const loadVaults = useCallback(() => entry.can.move && mode === 'move' ? vault.listVaults() : Promise.resolve([]), [entry.can.move, mode]); const vaults = useResource(loadVaults)
  const loadFolders = useCallback(() => target ? vault.listFolders(target) : Promise.resolve([]), [target]); const folders = useResource(loadFolders)
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); try { await action() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  const validExpiry = !expires || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expires) && Number.isFinite(Date.parse(expires))
  return <View style={{ gap: 12 }}>
    {entry.can.share && <View style={{ alignSelf: 'flex-start' }}><ToolButton icon="share" label="Share" a11y="Share entry" disabled={busy} onPress={() => setMode(mode === 'share' ? null : 'share')} /></View>}
    {entry.can.share && mode === 'share' && <Card><Field label="Find a person to share with" value={query} onChangeText={value => { setQuery(value); setPerson(null) }} />{people.value?.filter(p => p.is_active).map(p => <Button key={p.id} title={`${person?.id === p.id ? 'Selected: ' : ''}${p.name} (${p.email})`} disabled={busy} onPress={() => setPerson(p)} />)}
      <Field label="Share expiry UTC (optional, YYYY-MM-DDTHH:MM:SSZ)" value={expires} onChangeText={setExpires} autoCapitalize="none" /><Label>Leaving expiry blank grants access until it is revoked.</Label><Button title="Confirm entry share" disabled={busy || !person || !validExpiry} onPress={() => void run(async () => { if (!entry.can.share || !person || !validExpiry) return; if (expires && Date.parse(expires) <= Date.now()) throw new Error('Choose a future share expiry.'); await requireEntryPermission(() => vault.getEntry(entry.id), 'share'); await vault.shareEntry(entry.id, person.id, expires || undefined); await onRefresh(); setMode(null); setPerson(null); setQuery('') })} />
    </Card>}
    {entry.shares?.map(share => <Card key={share.id}><Label>Shared with {share.grantee.name}</Label><Label>{share.expires_at ? `Expires ${new Date(share.expires_at).toLocaleString()}` : 'No expiry'}</Label>{entry.can.revoke && <Button title={`Revoke access for ${share.grantee.name}`} disabled={busy} onPress={() => setRevoke(share)} />}</Card>)}
    {entry.can.revoke && revoke && <Card><Label>Revoke access for {revoke.grantee.name}?</Label><Button title="Confirm revoke access" disabled={busy} onPress={() => void run(async () => { if (!entry.can.revoke) return; await requireEntryPermission(() => vault.getEntry(entry.id), 'revoke'); await vault.revokeShare(entry.id, revoke.id); setRevoke(null); await onRefresh() })} /><Button title="Cancel revoke" disabled={busy} onPress={() => setRevoke(null)} /></Card>}
    {entry.can.move && <View style={{ alignSelf: 'flex-start' }}><ToolButton icon="arrowRightLeft" label="Move" a11y="Move entry" disabled={busy} onPress={() => setMode(mode === 'move' ? null : 'move')} /></View>}
    {entry.can.move && mode === 'move' && <Card><Label large>Destination vault</Label>{vaults.value?.filter(v => v.can.create_entry && !v.archived_at).map(v => <Button key={v.id} title={`${target === v.id ? 'Selected: ' : ''}${v.name}`} disabled={busy} onPress={() => { setTarget(v.id); setFolder(null) }} />)}{target && <><Button title={folder === null ? 'No folder selected' : 'Use no folder'} disabled={busy} onPress={() => setFolder(null)} />{folders.value?.map(f => <Button key={f.id} title={`${folder === f.id ? 'Selected folder: ' : 'Folder: '}${f.name}`} disabled={busy} onPress={() => setFolder(f.id)} />)}</>}
      <Label>Moving changes the vault and can change who has access.</Label><Button title="Confirm entry move" disabled={busy || !target || folders.loading} onPress={() => void run(async () => { if (!entry.can.move || !target || !vaults.value?.some(v => v.id === target && v.can.create_entry && !v.archived_at)) return; await requireEntryPermission(() => vault.getEntry(entry.id), 'move'); await vault.moveEntry(entry.id, target, folder); onMoved() })} />
    </Card>}
    {!!(error || people.error || vaults.error || folders.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || errorMessage(people.error || vaults.error || folders.error)}</Text>}{busy && <ActivityIndicator />}
  </View>
}
export function FolderManager({ vaultId, onClose, onChanged }: { vaultId: string; folders: vault.Folder[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const c = useColors(); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function create() {
    if (busy || !name.trim()) return
    setBusy(true); setError('')
    try { await vault.createFolder(vaultId, name.trim(), null); await onChanged(); onClose() }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <Sheet title="New folder" visible closeDisabled={busy} onClose={onClose} footer={<Button title="Create" size="sm" loading={busy} disabled={busy || !name.trim()} onPress={() => void create()} />}>
    <Field label="Name" value={name} onChangeText={setName} maxLength={120} inset={false} style={{ minHeight: 40, height: 40, fontSize: 14, paddingVertical: 8, paddingHorizontal: 12 }} />
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 14 }}>{error}</Text>}
  </Sheet>
}
