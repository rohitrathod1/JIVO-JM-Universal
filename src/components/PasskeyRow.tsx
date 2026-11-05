import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import type { PasskeyInfo } from '../core/auth/securityTypes'
import { formatDate, formatRelative } from '../shared/utils/format'
import { Button, Field, radius, useColors } from '../ui'
import { Icon, type IconName } from './Icon'
import { Pill, SettingRow } from './ProfileSection'

/** Reference `Button size="sm" variant="ghost"` holding only an icon (h-8 px-3). */
function GhostIcon({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors(); const [hover, setHover] = useState(false); const web = Platform.OS === 'web'
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={({ pressed }) => ({ minHeight: web ? 32 : 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: hover ? c.hover : 'transparent', opacity: disabled ? 0.5 : pressed ? 0.85 : 1, ...(web ? { cursor: disabled ? 'not-allowed' : 'pointer' } : {}) } as object)}>
    <Icon name={icon} size={16} color={c.text} />
  </Pressable>
}

/** Reference TwoStepSection PasskeyRow: name (+ Synced), "Added … · last used …", rename and remove. */
export function PasskeyRow({ passkey: p, first, disabled, onRename, onRemove }: { passkey: PasskeyInfo; first: boolean; disabled?: boolean; onRename: (name: string) => Promise<unknown>; onRemove: () => void }) {
  const c = useColors(); const [renaming, setRenaming] = useState(false); const [name, setName] = useState(p.name); const [saving, setSaving] = useState(false)
  const save = () => { const next = name.trim(); if (!next) return; setSaving(true); void onRename(next).finally(() => { setSaving(false); setRenaming(false) }) }
  const title = renaming
    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 384 }}><View style={{ flex: 1, minWidth: 0 }}><Field label="Passkey name" compact autoFocus value={name} maxLength={60} onChangeText={setName} onSubmitEditing={save} /></View><Button size="sm" title="Save" accessibilityLabel="Save passkey name" loading={saving} disabled={disabled || !name.trim()} onPress={save} /></View>
    : <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}><Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{p.name}</Text>{p.synced && <Pill>Synced</Pill>}</View>
  return <SettingRow chip icon="fingerprint" first={first} title={title} detail={`Added ${formatDate(p.created_at)}${p.last_used_at ? ` · last used ${formatRelative(p.last_used_at)}` : ' · not used yet'}`}>
    {!renaming && <GhostIcon icon="pencil" label={`Rename ${p.name}`} disabled={disabled} onPress={() => { setName(p.name); setRenaming(true) }} />}
    <GhostIcon icon="trash2" label={`Remove ${p.name}`} disabled={disabled} onPress={onRemove} />
  </SettingRow>
}
