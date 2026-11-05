import { useCallback, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createGroup, openDirect, searchPeople, type ConversationItem, type PersonCard } from '../modules/messenger/api'
import { Button, Field, glass, radius, useColors } from '../ui'
import { useSession } from '../core/auth/Session'
import { useCursor } from '../shared/useCursor'
import { errorMessage } from '../core/api/client'
import { ChatAvatar } from './ChatAvatar'
import { Icon } from './Icon'

const web = Platform.OS === 'web'
const pointer = (web ? { cursor: 'pointer' } : {}) as object
const hovered = (state: object) => Boolean((state as { hovered?: boolean }).hovered)

/** Reference SearchInput: h-10, control radius, border, white/90 fill, 16px search icon at left-3, clear button. */
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const c = useColors(); const [focused, setFocused] = useState(false)
  return <View style={{ justifyContent: 'center' }}>
    <TextInput selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent" value={value} onChangeText={onChange} placeholder={placeholder} accessibilityLabel={placeholder} placeholderTextColor={c.muted} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ height: 48, includeFontPadding: false, paddingVertical: 12, paddingLeft: 44, paddingRight: 44, paddingStart: 44, paddingEnd: 44, borderWidth: 1, borderRadius: radius.control, borderColor: focused ? c.brand : c.border, backgroundColor: web ? c.input : c.panel, color: c.text, fontFamily: 'Inter_400Regular', fontSize: web ? 14 : 16, ...(focused ? { boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.25)' } : {}), ...(web ? ({ outlineStyle: 'none' } as object) : {}) }} />
    <View pointerEvents="none" style={{ position: 'absolute', left: 16 }}><Icon name="search" size={16} /></View>
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} style={{ position: 'absolute', right: 8, padding: 4, borderRadius: 4, ...pointer }}><Icon name="x" size={16} /></Pressable>}
  </View>
}

/** Reference shared/ui/Button secondary, full width and left aligned (the New group / Message yourself rows). */
function RowButton({ onPress, disabled, children, label }: { onPress: () => void; disabled?: boolean; children: React.ReactNode; label: string }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={state => [glass(c, 2), { boxShadow: 'none', minHeight: 40, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.control, borderWidth: 1, borderColor: hovered(state) ? 'rgba(22,163,74,0.4)' : c.border, opacity: disabled ? 0.5 : state.pressed ? 0.85 : 1, ...pointer }]}>{children}</Pressable>
}

/** Reference NewChatDialog + PeoplePicker: "New chat" (pick a person) or "New group" (name + members), in the reference Dialog frame. */
export function ConversationPicker({ groupAllowed, onChoose, onClose }: { groupAllowed: boolean; onChoose: (value: ConversationItem) => void; onClose: () => void }) {
  const c = useColors(); const { me } = useSession(); const inset = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(false); const [title, setTitle] = useState(''); const [members, setMembers] = useState<PersonCard[]>([])
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback((cursor?: string | null) => searchPeople(query.trim(), cursor), [query])
  const page = useCursor(load)
  const { items: people, cursor } = page
  const close = () => { if (!busy) onClose() }
  async function direct(id: string) {
    setBusy(true); setError('')
    try { onChoose(await openDirect(id)) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  function choose(person: PersonCard) {
    if (group) { setMembers(list => list.some(m => m.id === person.id) ? list.filter(m => m.id !== person.id) : [...list, person]); return }
    void direct(person.id)
  }
  async function create() {
    setBusy(true); setError('')
    try { onChoose(await createGroup({ title: title.trim(), member_ids: members.map(m => m.id) })) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const selfMatches = me && (!query.trim() || `${me.name} ${me.email} ${me.employee_code || ''} you`.toLowerCase().includes(query.trim().toLowerCase()))
  const listedPeople: PersonCard[] = [
    ...(!group && selfMatches ? [{ id: me.id, name: me.name, email: me.email, avatar_url: me.avatar_url, company: null, is_active: true }] : []),
    ...people.filter(person => person.id !== me?.id),
  ]
  const chosen = new Set(members.map(m => m.id))
  const heading = group ? 'New group' : 'New chat'
  const people_ = <View style={{ gap: 12 }}>
    <SearchBox value={query} onChange={setQuery} placeholder="Search people by name, email or code" />
    <View accessibilityLabel="People" style={{ minHeight: 160, borderWidth: 1, borderColor: c.border, borderRadius: radius.card, overflow: 'hidden' }}>
      {page.loading && !listedPeople.length && <ActivityIndicator style={{ marginTop: 16 }} color={c.brand} />}
      {!page.loading && !listedPeople.length && !page.error && <Text style={{ padding: 24, textAlign: 'center', color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>No one matches.</Text>}
      {listedPeople.map(p => { const on = chosen.has(p.id); return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={group ? `${on ? 'Remove' : 'Select'} ${p.name}` : `Chat with ${p.name}${p.id === me?.id ? " (You)" : ""}`} accessibilityState={group ? { selected: on, disabled: busy || !p.is_active } : { disabled: busy || !p.is_active }} disabled={busy || !p.is_active} onPress={() => choose(p)}
        style={state => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: on ? c.successSoft : state.pressed || hovered(state) ? (c.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent', opacity: p.is_active ? 1 : 0.5, ...pointer })}>
        <ChatAvatar name={p.name} seed={p.id} uri={p.avatar_url} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 16, lineHeight: 22 }}>{p.name}{p.id === me?.id ? ' (You)' : ''}</Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{p.email || ''}{p.company ? `${p.email ? ' / ' : ''}${p.company}` : ''}</Text>
        </View>
        {group && on && <Icon name="check" size={16} color={c.brand} />}
      </Pressable> })}
      <View style={{ minHeight: 32, alignItems: 'center', justifyContent: 'center' }}>
        {cursor && <Pressable accessibilityRole="button" accessibilityLabel="More people" disabled={page.loading} onPress={() => void page.more()} style={{ paddingVertical: 6, paddingHorizontal: 12, ...pointer }}>{page.loading ? <ActivityIndicator color={c.brand} /> : <Text style={{ color: c.brand, fontFamily: 'Inter_500Medium', fontSize: 13 }}>More people</Text>}</Pressable>}
      </View>
    </View>
  </View>
  return <Modal visible onRequestClose={() => { if (group) setGroup(false); else close() }} animationType="slide">
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.shell, paddingTop: inset.top, paddingBottom: inset.bottom }}>
      <View accessibilityViewIsModal style={{ flex: 1, width: '100%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: c.border, paddingHorizontal: 12, height: 64 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={busy} onPress={() => { if (group) setGroup(false); else close() }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', ...pointer }}><Icon name="back" size={24} /></Pressable>
          <Text accessibilityRole="header" style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 20 }}>{heading}</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: group ? 16 : 12 }}>
          {!!(error || page.error) && <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{error || page.error}</Text>}
          {group ? <>
            <Field label="Group name" value={title} onChangeText={setTitle} maxLength={150} placeholder="e.g. Plant Ops — Ludhiana" autoFocus />
            {members.length > 0 && <View accessibilityLabel="Chosen members" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {members.map(m => <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: c.successSoft, paddingLeft: 10, paddingRight: 6, paddingVertical: 2 }}>
                <Text style={{ color: c.brand, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 12, lineHeight: 16 }}>{m.name}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} onPress={() => choose(m)} style={{ padding: 2, borderRadius: 999, ...pointer }}><Icon name="x" size={12} color={c.brand} /></Pressable>
              </View>)}
            </View>}
            {people_}
          </> : <>
            {groupAllowed && <RowButton label="New group" disabled={busy} onPress={() => { setGroup(true); setError('') }}><Icon name="users" size={16} color={c.text} /><Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>New group</Text></RowButton>}
            {people_}
          </>}
          {busy && <ActivityIndicator color={c.brand} />}
        </ScrollView>
        {group && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderColor: c.border, paddingHorizontal: 20, paddingVertical: 12 }}>
          <Button variant="secondary" title="Back" disabled={busy} onPress={() => setGroup(false)} />
          <Button title="Create group" accessibilityLabel={`Create group (${members.length} selected)`} loading={busy} disabled={!title.trim() || !members.length} onPress={() => void create()} />
        </View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>
}
