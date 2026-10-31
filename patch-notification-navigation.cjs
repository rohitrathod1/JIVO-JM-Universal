const fs=require('fs');const write=(p,s)=>{fs.mkdirSync(require('path').dirname(p),{recursive:true});fs.writeFileSync(p,s)};const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
write('src/shared/notificationTarget.ts',`export type Target = { pathname: '/messenger' | '/passwords' | '/admin' | '/profile' | '/notifications'; params?: Record<string, string> }
export function notificationTarget(link: string | null | undefined): Target | null {
 if (!link || !link.startsWith('/') || link.startsWith('//') || /[\\\\\\x00-\\x20]/.test(link)) return null
 const [path, query = ''] = link.split('?'); const params = new URLSearchParams(query); const parts = path.split('/').filter(Boolean)
 if (parts.some(p => !/^[a-zA-Z0-9_-]+$/.test(p))) return null
 if (parts[0] === 'messenger' && parts.length <= 2) { const seq = params.get('seq'); return { pathname: '/messenger', params: { ...(parts[1] ? { conversation: parts[1] } : {}), ...(seq && /^[1-9]\\d*$/.test(seq) && Number.isSafeInteger(Number(seq)) ? { seq } : {}) } } }
 if (parts[0] === 'passwords') {
  if (parts.length === 1) return { pathname: '/passwords' }
  if (parts.length === 2 && ['shared', 'admin', 'break-glass'].includes(parts[1])) return { pathname: '/passwords', params: { view: parts[1] } }
  if (parts[1] === 'entries' && parts.length === 3) return { pathname: '/passwords', params: { entry: parts[2] } }
  if (parts[1] === 'vaults' && (parts.length === 3 || parts.length === 4 && parts[3] === 'activity')) return { pathname: '/passwords', params: { vault: parts[2], ...(parts[3] ? { view: 'activity' } : {}) } }
 }
 if (parts[0] === 'admin') { if (parts.length === 1) return { pathname: '/admin' }; if (parts[1] === 'users' && parts.length === 3) return { pathname: '/admin', params: { tab: 'people', user: parts[2] } }; if (parts.length === 2 && ['users','companies','groups','approvals','security'].includes(parts[1])) return { pathname: '/admin', params: { tab: parts[1] === 'users' ? 'people' : parts[1] } } }
 if (parts.length === 1 && (parts[0] === 'profile' || parts[0] === 'notifications')) return { pathname: '/' + parts[0] as '/profile' | '/notifications' }
 return null
}
`);
write('src/shared/notificationTarget.test.ts',`import { expect, it } from 'vitest'
import { notificationTarget } from './notificationTarget'
it('maps original internal links without forwarding arbitrary parameters', () => {
 expect(notificationTarget('/messenger/chat-id?seq=42&token=secret')).toEqual({ pathname: '/messenger', params: { conversation: 'chat-id', seq: '42' } })
 expect(notificationTarget('/passwords/vaults/vault-id/activity')).toEqual({ pathname: '/passwords', params: { vault: 'vault-id', view: 'activity' } })
 expect(notificationTarget('/passwords/entries/entry')).toEqual({ pathname: '/passwords', params: { entry: 'entry' } })
 expect(notificationTarget('/admin/users/user')).toEqual({ pathname: '/admin', params: { tab: 'people', user: 'user' } })
})
it.each(['https://evil.invalid', '//evil.invalid', '/passwords/../admin', '/messenger/%2fsecret', '/messenger/a/b', '/unknown', '/messenger/a\\\\b'])('rejects unsafe or unsupported link %s', link => expect(notificationTarget(link)).toBeNull())
`);
edit('src/components/ActivityPanel.tsx',s=>"import { router } from 'expo-router'\nimport { notificationTarget } from '../shared/notificationTarget'\n"+s.replace('<Label>{selected?.body}</Label><Button title="Close notification"','<Label>{selected?.body}</Label>{selected?.link && (notificationTarget(selected.link) ? <Button title="Go to linked item" onPress={() => { const target = notificationTarget(selected.link); if (target) { setSelected(null); router.push(target) } }} /> : <Label>This notification destination is not available in this client.</Label>)}<Button title="Close notification"'));
write('src/components/Messenger.tsx',`import { useCallback } from 'react'
import { ActivityIndicator } from 'react-native'
import { Messenger as ConversationWorkspace } from './ConversationWorkspace'
import { useSession } from '../core/auth/Session'
import { useResource } from '../shared/useResource'
import { getConversation } from '../modules/messenger/api'
import { Button, Label } from '../ui'
import { errorMessage } from '../core/api/client'
function LinkedConversation({ id, seq }: { id: string; seq?: number }) { const load = useCallback(() => getConversation(id), [id]); const resource = useResource(load); if (resource.loading) return <ActivityIndicator />; if (resource.error) return <><Label>{errorMessage(resource.error)}</Label><Button title="Retry linked conversation" onPress={resource.refresh} /></>; return resource.value ? <ConversationWorkspace initialConversation={resource.value} initialSeq={seq} /> : null }
export function Messenger({ preview = false, conversation, seq }: { preview?: boolean; conversation?: string; seq?: number }) { const { me } = useSession(); if (!preview && !me?.capabilities.includes('JM_ACCESS')) return <Label>Messenger access is not enabled for your account.</Label>; return conversation ? <LinkedConversation key={conversation + ':' + seq} id={conversation} seq={seq} /> : <ConversationWorkspace preview={preview} /> }
`);
edit('src/components/ConversationWorkspace.tsx',s=>s.replace("{ preview = false }: { preview?: boolean }", "{ preview = false, initialConversation, initialSeq }: { preview?: boolean; initialConversation?: chat.ConversationItem; initialSeq?: number }").replace('useState<chat.ConversationItem | null>(null)', 'useState<chat.ConversationItem | null>(initialConversation ?? null)').replace('void history.select(selectedId ?? null)', 'void history.select(selectedId ?? null, selectedId === initialConversation?.id ? initialSeq : undefined)').replace('[selectedId, preview, history]', '[selectedId, preview, history, initialConversation?.id, initialSeq]'));
edit('src/modules/messenger/history.ts',s=>s.replace('select = async (id: string | null)', 'select = async (id: string | null, around?: number)').replace('this.deps.read(id)])','this.deps.read(id, around ? { around } : undefined)])').replace('detail, targetSeq: null, window:', 'detail, targetSeq: around ?? null, window:'));
write('src/app/messenger.tsx',`import { useLocalSearchParams } from 'expo-router'
import { Workspace } from '../components/Workspace'
import { Messenger } from '../components/Messenger'
export default function Screen() { const p = useLocalSearchParams<{ conversation?: string; seq?: string }>(); const seq = Number(p.seq); return <Workspace><Messenger key={p.conversation ?? 'list'} conversation={typeof p.conversation === 'string' ? p.conversation : undefined} seq={Number.isSafeInteger(seq) && seq > 0 ? seq : undefined} /></Workspace> }
`);
edit('src/components/Workspace.tsx',s=>s.replace("    { title: 'Messenger', href: '/messenger' },", "    ...(preview || allows(me?.capabilities ?? [], 'JM_ACCESS') ? [{ title: 'Messenger', href: '/messenger' }] : []),"));
write('src/app/passwords.tsx',`import { useLocalSearchParams } from 'expo-router'
import { Workspace } from '../components/Workspace'
import { VaultPanel } from '../components/VaultPanel'
export default function Screen() { const p = useLocalSearchParams<{ vault?: string; entry?: string; view?: string }>(); return <Workspace><VaultPanel key={[p.vault,p.entry,p.view].join(':')} initialVault={typeof p.vault === 'string' ? p.vault : undefined} initialEntry={typeof p.entry === 'string' ? p.entry : undefined} initialView={typeof p.view === 'string' ? p.view : undefined} /></Workspace> }
`);
edit('src/components/VaultPanel.tsx',s=>{s=s.replace('export function VaultPanel() {\n  const [shared, setShared] = useState(false)', `export function VaultPanel({ initialVault, initialEntry, initialView }: { initialVault?: string; initialEntry?: string; initialView?: string }) {
  const [linkedEntry, setLinkedEntry] = useState<vault.Entry | null>(null)
  const [shared, setShared] = useState(initialView === 'shared')`);s=s.replace('if (active) setItems(values)', 'if (active) { setItems(values); if (initialVault) { const found = values.find(v => v.id === initialVault); if (found) setSelected(found); else void vault.getVault(initialVault).then(v => { if (active) setSelected(v) }).catch(e => { if (active) setError(errorMessage(e)) }) } }');s=s.replace('[me?.capabilities])','[me?.capabilities, initialVault])');s=s.replace("  if (!me?.capabilities.includes('JP_ACCESS'))", "  useEffect(() => { let active = true; if (initialEntry && me?.capabilities.includes('JP_ACCESS')) vault.getEntry(initialEntry).then(value => { if (active) setLinkedEntry(value) }).catch(e => { if (active) setError(errorMessage(e)) }); return () => { active = false } }, [initialEntry, me?.capabilities])\n  if (!me?.capabilities.includes('JP_ACCESS'))");s=s.replace("    {shared ? <SharedEntries />", "    {linkedEntry && <EntryDetails entry={linkedEntry} onClose={() => setLinkedEntry(null)} onChanged={() => setLinkedEntry(null)} />}\n    {shared ? <SharedEntries />");return s;});
