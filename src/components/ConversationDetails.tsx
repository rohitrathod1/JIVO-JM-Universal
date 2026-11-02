import { chatLock } from '../modules/messenger/chatLock'
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native'
import * as chat from '../modules/messenger/api'
import { MEMBERS_FIRST, MEMBERS_MORE, SEND_MODES, memberWindow, moreMembersLabel, sendModeNote } from '../modules/messenger/conversationInfo'
import { mediaUrl } from '../modules/messenger/media/url'
import { errorMessage, origin } from '../core/api/client'
import { useCursor } from '../shared/useCursor'
import { useResource } from '../shared/useResource'
import { Button, Card, Field, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
import { GroupPhoto } from './GroupPhoto'
import { SharedMedia } from './SharedMedia'
import { ChatAvatar } from './ChatAvatar'
import { IconButton } from './Icon'
import { PersonDetails, PersonProfileView } from './PersonDetails'

type Confirm = { at: string; title: string; label?: string; action: () => Promise<unknown> }

function Badge({ children, tone }: { children: string; tone: 'warning' | 'info' | 'success' | 'neutral' }) {
  const c = useColors()
  const colors = { warning: [c.dark ? '#3d2f12' : '#fef3c7', c.dark ? '#fcd34d' : '#92400e'], info: [c.dark ? '#1e3a5f' : '#dbeafe', c.dark ? '#93c5fd' : '#1e40af'], success: [c.soft, c.primary], neutral: [c.neutral, c.muted] }[tone]
  return <Text style={{ backgroundColor: colors[0], color: colors[1], fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>{children}</Text>
}

function Section({ title, children, right }: { title: string; children?: ReactNode; right?: ReactNode }) {
  const c = useColors()
  return <View style={{ gap: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={{ flex: 1, color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 24 }}>{title}</Text>{right}</View>{children}</View>
}

/** Group settings: name and description (Frontend GroupInfo "Group settings"). */
function GroupEditor({ detail, onSaved }: { detail: chat.ConversationDetail; onSaved: () => void }) {
  const c = useColors(); const [title, setTitle] = useState(detail.title); const [description, setDescription] = useState(detail.description); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const unchanged = title === detail.title && description === detail.description
  return <View style={{ gap: 12 }}>
    <Field label="Name" accessibilityLabel="Group title" value={title} maxLength={100} onChangeText={setTitle} />
    <Field label="Description" accessibilityLabel="Group description" value={description} maxLength={1000} onChangeText={setDescription} multiline />
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}
    <Button title="Save" accessibilityLabel="Save group information" style={{ alignSelf: 'flex-start' }} disabled={busy || !title.trim() || unchanged} onPress={() => { setBusy(true); setError(''); void chat.updateGroup(detail.id, { title: title.trim(), description }).then(onSaved).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} />
  </View>
}

/** Who may send: everyone, selected members (plus admins) or admins only. Saved together, after re-checking the group. */
function MessagingPermissions({ detail, members, onSaved }: { detail: chat.ConversationDetail; members: chat.Member[]; onSaved: () => void }) {
  const c = useColors()
  const initial = useMemo(() => members.filter(m => m.role === 'member' && m.can_send && detail.send_mode === 'selected').map(m => m.user.id), [members, detail.send_mode])
  const [mode, setMode] = useState<chat.SendMode>(detail.send_mode); const [senders, setSenders] = useState<string[] | null>(null); const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false)
  const chosen = senders ?? initial
  const plain = members.filter(m => m.role === 'member')
  const shown = plain.filter(m => m.user.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const changed = mode !== detail.send_mode || (mode === 'selected' && [...chosen].sort().join() !== [...initial].sort().join())
  async function save() {
    setBusy(true); setError(''); setSaved(false)
    try {
      const [fresh, current] = await Promise.all([chat.getConversation(detail.id), chat.listMembers(detail.id)])
      if (!fresh.can.edit_info || (mode === 'selected' && chosen.some(id => !current.some(m => m.user.id === id && m.role === 'member')))) throw new Error('Group permissions or membership changed. Reopen these settings.')
      await chat.setSendMode(detail.id, mode, mode === 'selected' ? chosen : []); setSenders(null); setSaved(true); onSaved()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <Section title="Messaging permissions">
    <View accessibilityRole="radiogroup" style={{ gap: 6 }}>{SEND_MODES.map(option => { const on = mode === option.value; return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: busy }} accessibilityLabel={option.label} disabled={busy} onPress={() => setMode(option.value)}
      style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: on ? c.brand : c.border, backgroundColor: on ? c.soft : 'transparent' }}>
      <View style={{ width: 18, height: 18, marginTop: 2, borderRadius: 9, borderWidth: 2, borderColor: on ? c.primary : c.muted, alignItems: 'center', justifyContent: 'center' }}>{on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />}</View>
      <View style={{ flex: 1 }}><Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{option.label}</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 16 }}>{option.detail}</Text></View>
    </Pressable> })}</View>
    {mode === 'selected' && <View style={{ gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Senders <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular' }}>· admins always can · {chosen.length} chosen</Text></Text>
      {plain.length > 6 && <Field label="Search members" compact placeholder="Search members" value={filter} onChangeText={setFilter} />}
      {shown.map(m => <View key={m.user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Label>{m.is_me ? 'You' : m.user.name}</Label></View><Switch accessibilityLabel={`Allow sender ${m.user.name}`} disabled={busy} value={chosen.includes(m.user.id)} onValueChange={on => setSenders(on ? [...chosen, m.user.id] : chosen.filter(id => id !== m.user.id))} /></View>)}
      {!shown.length && <Text style={{ color: c.muted, fontSize: 14 }}>{plain.length ? 'No member matches.' : 'Everyone here is an admin.'}</Text>}
    </View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}
    {saved && !changed && <Text accessibilityRole="alert" style={{ color: c.primary }}>Messaging permissions saved</Text>}
    <Button title="Save permissions" style={{ alignSelf: 'flex-start' }} disabled={busy || !changed} onPress={() => void save()} />
  </Section>
}

/** Peer profile for a direct chat: the same profile layout, with this chat's Media / Docs / Links. */
function DirectProfile({ detail, shared }: { detail: chat.ConversationDetail; shared: boolean }) {
  const peer = detail.peer?.id ?? null
  const load = useCallback(() => peer ? chat.getPerson(peer) : Promise.resolve(null), [peer]); const resource = useResource(load)
  if (!peer) return shared ? <SharedMedia key={`shared:${detail.id}`} conversation={detail.id} /> : null
  return <>{resource.loading && <ActivityIndicator />}{!!resource.error && <><Label>{errorMessage(resource.error)}</Label><Button title="Retry profile" onPress={resource.refresh} /></>}
    {resource.value && <PersonProfileView profile={resource.value} conversation={shared ? detail.id : null} />}</>
}

export function ConversationDetails({ conversation, onClose, onChanged, onLeave, onClear }: { conversation: string; onClose: () => void; onChanged: () => void; onLeave: () => void; onClear: () => void }) {
  const c = useColors(); const load = useCallback(async () => ({ detail: await chat.getConversation(conversation), members: await chat.listMembers(conversation) }), [conversation]); const resource = useResource(load)
  const [view, setView] = useState<'info' | 'settings' | 'add'>('info'); const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState(''); const [selected, setSelected] = useState<string[]>([]); const [recent, setRecent] = useState(false)
  const peopleLoad = useCallback((cursor?: string | null) => view === 'add' ? chat.searchPeople(query, cursor) : Promise.resolve({ results: [], next_cursor: null }), [view, query]); const people = useCursor(peopleLoad)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [shown, setShown] = useState(MEMBERS_FIRST); const [searching, setSearching] = useState(false); const [term, setTerm] = useState(''); const [memberMenu, setMemberMenu] = useState<string | null>(null)
  const [person, setPerson] = useState<chat.PersonCard | null>(null)
  async function run(action: () => Promise<unknown>) { if (busy) return; setBusy(true); setError(''); try { await action(); setConfirm(null); setMemberMenu(null); resource.refresh(); onChanged() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  const refreshAll = () => { resource.refresh(); onChanged() }
  const detail = resource.value?.detail; const rows = resource.value?.members ?? []
  const lock = useSyncExternalStore(chatLock.subscribe, chatLock.snapshot, chatLock.snapshot)
  const shared = !!detail && (!detail.locked || lock.unlocked)
  const group = detail?.kind === 'group'
  const members = memberWindow(rows, term, shown)
  const confirmCard = (at: string) => confirm?.at === at && <Card style={{ padding: 12, gap: 8 }}><Label>{confirm.title}</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button title={confirm.label ?? 'Confirm'} accessibilityLabel="Confirm conversation change" disabled={busy} onPress={() => void run(confirm.action)} /><Button title="Cancel" variant="secondary" accessibilityLabel="Cancel conversation change" disabled={busy} onPress={() => setConfirm(null)} /></View></Card>
  const back = (title: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><IconButton name="back" label="Back to group info" disabled={busy} onPress={() => { setView('info'); setSelected([]) }} /><Label large>{title}</Label></View>
  const status = <>{resource.loading && !detail && <ActivityIndicator />}{!!(error || resource.error || people.error) && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error || (resource.error ? errorMessage(resource.error) : people.error)}</Text>}</>

  if (detail && group && view === 'settings' && detail.can.edit_info) return <Sheet visible onClose={() => { if (!busy) onClose() }}>{back('Group settings')}{status}
    <GroupPhoto detail={detail} onChanged={refreshAll} />
    <GroupEditor key={`${detail.id}:${detail.title}:${detail.description}`} detail={detail} onSaved={refreshAll} />
    <MessagingPermissions key={`${detail.send_mode}-${rows.map(m => `${m.user.id}${m.can_send}`).join()}`} detail={detail} members={rows} onSaved={refreshAll} />
  </Sheet>

  if (detail && group && view === 'add' && detail.can.manage_members) return <Sheet visible onClose={() => { if (!busy) onClose() }}>{back('Add members')}{status}
    <Field label="Find group members" value={query} onChangeText={setQuery} />
    {people.items.filter(p => !rows.some(m => m.user.id === p.id)).map(p => <Button key={p.id} variant={selected.includes(p.id) ? 'primary' : 'secondary'} title={`${selected.includes(p.id) ? 'Selected: ' : ''}${p.name}`} accessibilityLabel={p.name} disabled={busy || !p.is_active} onPress={() => setSelected(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])} />)}
    {people.cursor && <Button title="More potential members" variant="ghost" disabled={people.loading} onPress={() => void people.more()} />}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><Label>Share recent history</Label><Text style={{ color: c.muted, fontSize: 12 }}>New members can read the last 100 messages.</Text></View><Switch accessibilityLabel="Share recent group history" value={recent} onValueChange={setRecent} /></View>
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Button title="Cancel" variant="secondary" disabled={busy} onPress={() => { setView('info'); setSelected([]) }} /><Button title={`Add${selected.length ? ` ${selected.length}` : ''}`} accessibilityLabel={`Add ${selected.length} members`} disabled={busy || !selected.length} onPress={() => void run(async () => { await chat.addMembers(conversation, selected, recent ? 'recent' : 'none'); setSelected([]); setView('info') })} /></View>
  </Sheet>

  return <Sheet visible onClose={() => { if (!busy) onClose() }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ flex: 1 }}><Label large>{group ? 'Group info' : detail?.kind === 'direct' && detail.peer && !detail.is_self ? 'Profile' : 'Conversation details'}</Label></View>
      {group && (detail.can.edit_info || detail.can.manage_members) && <IconButton name="menu" label="Group options" onPress={() => setMenu(open => !open)} />}</View>
    {menu && group && <Card style={{ padding: 6, gap: 2, alignSelf: 'flex-end', minWidth: 200 }}>
      {detail.can.edit_info && <Button title="Group settings" variant="ghost" style={{ alignItems: 'flex-start' }} onPress={() => { setMenu(false); setView('settings') }} />}
      {detail.can.manage_members && <Button title="Add members" variant="ghost" style={{ alignItems: 'flex-start' }} onPress={() => { setMenu(false); setView('add') }} />}
    </Card>}
    {status}
    {group && <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}><ChatAvatar name={detail.title} seed={detail.id} uri={mediaUrl(detail.avatar_url, origin)} group size={64} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26 }}>{detail.title}</Text><Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>Group · {detail.member_count} members</Text>
        {!!detail.description && <Text selectable style={{ color: c.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{detail.description}</Text>}
        {!!detail.restricted_company && <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 4 }}>Only members of {detail.restricted_company} can join this group.</Text>}</View></View>}
    {group && !detail.can.edit_info && !!sendModeNote(detail.send_mode, !!detail.send_block) && <Text accessibilityRole="text" style={{ color: c.text, backgroundColor: c.neutral, padding: 10, borderRadius: 10, fontSize: 14, lineHeight: 20 }}>{sendModeNote(detail.send_mode, !!detail.send_block)}</Text>}
    {detail && !group && <DirectProfile detail={detail} shared={shared} />}
    {group && shared && <SharedMedia key={`shared:${conversation}`} conversation={conversation} />}
    {group && <Section title={`${detail.member_count} members`} right={<>
      <IconButton name="search" label={searching ? 'Close member search' : 'Search members'} onPress={() => { setSearching(v => !v); setTerm('') }} />
      {detail.can.manage_members && <Button title="Add" accessibilityLabel="Add group members" variant="secondary" disabled={busy} onPress={() => setView('add')} />}</>}>
      {searching && <Field label="Search members" compact placeholder="Search members" autoFocus value={term} onChangeText={setTerm} />}
      {!!term.trim() && !members.matching.length && <Text style={{ color: c.muted, textAlign: 'center', paddingVertical: 8 }}>No members match.</Text>}
      {members.visible.map(m => { const canRole = detail.is_owner; const canRemove = detail.can.manage_members; const actions = !m.is_me && m.role !== 'owner' && (canRole || canRemove); return <View key={m.user.id} style={{ gap: 6, borderTopWidth: 1, borderColor: c.border, paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${m.user.name}'s profile`} onPress={() => setPerson(m.user)} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, borderRadius: 10, backgroundColor: pressed ? c.neutral : 'transparent' })}>
            <ChatAvatar name={m.user.name} seed={m.user.id} uri={mediaUrl(m.user.avatar_url, origin)} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{m.is_me ? 'You' : m.user.name}</Text>{!!m.user.company && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12, lineHeight: 16 }}>{m.user.company}</Text>}</View>
          </Pressable>
          {m.role === 'owner' ? <Badge tone="warning">Owner</Badge> : m.role === 'admin' ? <Badge tone="info">Admin</Badge> : null}
          {detail.send_mode !== 'everyone' && m.role === 'member' && <Badge tone={m.can_send ? 'success' : 'neutral'}>{m.can_send ? 'Can send' : 'Read only'}</Badge>}
          {actions && <IconButton name="menu" label={`Actions for ${m.user.name}`} disabled={busy} onPress={() => setMemberMenu(id => id === m.user.id ? null : m.user.id)} />}
        </View>
        {actions && memberMenu === m.user.id && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          {canRole && <Button variant="secondary" title={m.role === 'admin' ? 'Remove as admin' : 'Make admin'} accessibilityLabel={m.role === 'admin' ? `Make ${m.user.name} a member` : `Make ${m.user.name} an admin`} disabled={busy} onPress={() => setConfirm({ at: m.user.id, title: `Change ${m.user.name}'s group role?`, action: () => chat.setMemberRole(conversation, m.user.id, m.role === 'admin' ? 'member' : 'admin') })} />}
          {canRemove && <Button variant="secondary" title="Remove from group" accessibilityLabel={`Remove ${m.user.name}`} disabled={busy} onPress={() => setConfirm({ at: m.user.id, title: `Remove ${m.user.name} from this group?`, label: 'Remove', action: () => chat.removeMember(conversation, m.user.id) })} />}
        </View>}
        {confirmCard(m.user.id)}
      </View> })}
      {members.left > 0 && <Button variant="ghost" title={moreMembersLabel(members.left)} onPress={() => setShown(n => n + MEMBERS_MORE)} />}
    </Section>}
    {detail?.can.set_disappearing && <Section title="Disappearing messages"><Text style={{ color: c.muted, fontSize: 14 }}>New messages disappear after the selected time.</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([{ seconds: 0, label: 'Off' }, { seconds: 86400, label: '24 hours' }, { seconds: 604800, label: '7 days' }, { seconds: 7776000, label: '90 days' }] as const).map(option => { const on = (detail.disappearing_seconds ?? 0) === option.seconds; return <Button key={option.seconds} variant={on ? 'primary' : 'secondary'} title={option.label} accessibilityLabel={`${option.label}${on ? ' selected' : ''}`} disabled={busy} onPress={() => void run(() => chat.setDisappearing(conversation, option.seconds))} /> })}</View></Section>}
    {detail && <View style={{ gap: 4 }}>
      <Button variant="ghost" style={{ alignItems: 'flex-start' }} title={detail.muted_until ? 'Unmute conversation' : 'Mute for 8 hours'} disabled={busy} onPress={() => void run(() => chat.updateSettings(conversation, { muted_until: detail.muted_until ? null : new Date(Date.now() + 8 * 3600000).toISOString() }))} />
      <Button variant="ghost" style={{ alignItems: 'flex-start' }} title="Clear conversation for me" disabled={busy} onPress={() => setConfirm({ at: 'clear', title: 'Clear your conversation history? Other participants keep their history.', label: 'Clear', action: async () => { await chat.clearChat(conversation); onClear() } })} />
      {confirmCard('clear')}
      {detail.can.leave && <Pressable accessibilityRole="button" accessibilityLabel={group ? 'Leave group' : 'Leave conversation'} disabled={busy} onPress={() => setConfirm({ at: 'leave', title: group ? `Leave ${detail.title}? You will stop receiving messages. You can still read what was sent while you were a member.` : 'Leave this conversation?', label: group ? 'Leave group' : 'Leave', action: async () => { await chat.leaveConversation(conversation); onLeave() } })} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, opacity: busy ? 0.45 : 1 }}><Text style={{ color: c.danger, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{group ? 'Leave group' : 'Leave conversation'}</Text></Pressable>}
      {confirmCard('leave')}
    </View>}
    <Button title="Close" variant="secondary" accessibilityLabel="Close conversation details" disabled={busy} onPress={onClose} />
    {person && <PersonDetails person={person} onClose={() => setPerson(null)} />}
  </Sheet>
}
