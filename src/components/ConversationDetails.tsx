import { useCallback, useState } from 'react'
import { ActivityIndicator, Switch, Text, View } from 'react-native'
import * as chat from '../modules/messenger/api'
import { errorMessage } from '../core/api/client'
import { useCursor } from '../shared/useCursor'
import { useResource } from '../shared/useResource'
import { Button, Card, Field, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
import { GroupPhoto } from './GroupPhoto'
import { SelectedSenders } from './SelectedSenders'
function GroupEditor({ detail, onSaved }: { detail: chat.ConversationDetail; onSaved: () => void }) {
  const c = useColors(); const [title, setTitle] = useState(detail.title); const [description, setDescription] = useState(detail.description); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  return <Card><Label large>Group information</Label><Field label="Group title" value={title} onChangeText={setTitle} /><Field label="Group description" value={description} onChangeText={setDescription} multiline />{!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}<Button title="Save group information" disabled={busy || !title.trim()} onPress={() => { setBusy(true); void chat.updateGroup(detail.id, { title: title.trim(), description }).then(onSaved).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} /></Card>
}
export function ConversationDetails({ conversation, onClose, onChanged, onLeave, onClear }: { conversation: string; onClose: () => void; onChanged: () => void; onLeave: () => void; onClear: () => void }) {
  const c = useColors(); const load = useCallback(async () => ({ detail: await chat.getConversation(conversation), members: await chat.listMembers(conversation) }), [conversation]); const resource = useResource(load)
  const [query, setQuery] = useState(''); const [adding, setAdding] = useState(false); const [selected, setSelected] = useState<string[]>([]); const [recent, setRecent] = useState(false)
  const peopleLoad = useCallback((cursor?: string | null) => adding ? chat.searchPeople(query, cursor) : Promise.resolve({ results: [], next_cursor: null }), [adding, query]); const people = useCursor(peopleLoad)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [confirm, setConfirm] = useState<{ title: string; action: () => Promise<unknown> } | null>(null)
  async function run(action: () => Promise<unknown>) { if (busy) return; setBusy(true); setError(''); try { await action(); setConfirm(null); resource.refresh(); onChanged() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  const detail = resource.value?.detail
  return <Sheet visible onClose={() => { if (!busy) onClose() }}><Label large>{detail?.title || detail?.peer?.name || 'Conversation details'}</Label>
    {resource.loading && <ActivityIndicator />}{!!(error || resource.error || people.error) && <Text accessibilityRole="alert" style={{ color: c.text }}>{error || (resource.error ? errorMessage(resource.error) : people.error)}</Text>}
    {detail?.kind === 'group' && detail.can.edit_info && <GroupPhoto detail={detail} onChanged={()=>{resource.refresh();onChanged()}}/>}
    {detail?.kind === 'group' && detail.can.edit_info && <GroupEditor key={detail.id} detail={detail} onSaved={() => { resource.refresh(); onChanged() }} />}
    {resource.value?.members.map(member => <Card key={member.user.id}><Label>{member.user.name} · {member.role}{member.is_me ? ' · You' : ''}</Label><Label>{member.can_send ? 'Can send messages' : 'Sending restricted'}</Label>
      {detail?.can.manage_members && member.role !== 'owner' && !member.is_me && <><Button title={member.role === 'admin' ? `Make ${member.user.name} a member` : `Make ${member.user.name} an admin`} disabled={busy} onPress={() => setConfirm({ title: `Change ${member.user.name}'s group role?`, action: () => chat.setMemberRole(conversation, member.user.id, member.role === 'admin' ? 'member' : 'admin') })} /><Button title={`Remove ${member.user.name}`} disabled={busy} onPress={() => setConfirm({ title: `Remove ${member.user.name} from this group?`, action: () => chat.removeMember(conversation, member.user.id) })} /></>}
    </Card>)}
    {detail?.can.manage_members && <><Button title={adding ? 'Close member search' : 'Add group members'} disabled={busy} onPress={() => setAdding(v => !v)} />
      {adding && <><Field label="Find group members" value={query} onChangeText={setQuery} />{people.items.filter(person => !resource.value?.members.some(m => m.user.id === person.id)).map(person => <Button key={person.id} title={`${selected.includes(person.id) ? 'Selected: ' : ''}${person.name}`} disabled={busy || !person.is_active} onPress={() => setSelected(ids => ids.includes(person.id) ? ids.filter(id => id !== person.id) : [...ids, person.id])} />)}{people.cursor && <Button title="More potential members" disabled={people.loading} onPress={() => void people.more()} />}<Label>Share recent history with new members</Label><Switch accessibilityLabel="Share recent group history" value={recent} onValueChange={setRecent} /><Button title={`Add ${selected.length} members`} disabled={busy || !selected.length} onPress={() => void run(async () => { await chat.addMembers(conversation, selected, recent ? 'recent' : 'none'); setSelected([]); setAdding(false) })} /></>}
      <SelectedSenders key={JSON.stringify([detail.send_mode,resource.value?.members])} detail={detail} members={resource.value?.members ?? []} onChanged={() => { resource.refresh(); onChanged() }} /><Label>Who can send</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['everyone', 'admins'] as const).map(mode => <Button key={mode} title={`${mode}${detail.send_mode === mode ? ' selected' : ''}`} disabled={busy} onPress={() => setConfirm({ title: `Allow ${mode} to send messages?`, action: () => chat.setSendMode(conversation, mode) })} />)}</View>
    </>}
    {detail && <><Button title={detail.muted_until ? 'Unmute conversation' : 'Mute for 8 hours'} disabled={busy} onPress={() => void run(() => chat.updateSettings(conversation, { muted_until: detail.muted_until ? null : new Date(Date.now() + 8 * 3600000).toISOString() }))} /><Button title="Clear conversation for me" disabled={busy} onPress={() => setConfirm({ title: 'Clear your conversation history? Other participants keep their history.', action: async () => { await chat.clearChat(conversation); onClear() } })} /></>}
    {detail?.can.leave && <Button title="Leave conversation" disabled={busy} onPress={() => setConfirm({ title: 'Leave this conversation?', action: async () => { await chat.leaveConversation(conversation); onLeave() } })} />}
    {confirm && <Card><Label>{confirm.title}</Label><Button title="Confirm conversation change" disabled={busy} onPress={() => void run(confirm.action)} /><Button title="Cancel conversation change" disabled={busy} onPress={() => setConfirm(null)} /></Card>}
    <Button title="Close conversation details" disabled={busy} onPress={onClose} />
  </Sheet>
}
