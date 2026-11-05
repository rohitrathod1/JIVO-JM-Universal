import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { randomUUID } from 'expo-crypto'
import { errorMessage } from '../core/api/client'
import { uploadLimitError, type PickedFile } from '../modules/messenger/media/model'
import { pickDocument } from '../modules/messenger/media/picker'
import { useColors } from '../ui'
import { Icon, IconButton } from './Icon'
import { PhotoEditor } from './PhotoEditor'

type Item = { key: string; file: PickedFile }
export function AttachmentPreview({ initialFile, initialCaption, conversation, onClose, onSend }: {
  initialFile: PickedFile; initialCaption: string; conversation: string; onClose: () => void
  onSend: (files: Item[], caption: string, clientId: string) => Promise<void>
}) {
  const c = useColors(); const inset = useSafeAreaInsets()
  const [items, setItems] = useState<Item[]>(() => [{ key: randomUUID(), file: initialFile }])
  const owned = useRef(items); const alive = useRef(true)
  const operation = useRef(false)
  const [selected, setSelected] = useState(items[0].key)
  const [caption, setCaption] = useState(initialCaption)
  const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(''); const [error, setError] = useState('')
  const clientId = useRef(randomUUID())
  const current = items.find(i => i.key === selected) ?? items[0]
  function update(next: Item[]) { owned.current = next; setItems(next); clientId.current = randomUUID() }
  async function dispose(item: Item) {
    await Promise.resolve(item.file.dispose?.()).catch(() => {})
  }
  useEffect(() => { alive.current = true; return () => { alive.current = false; for (const item of owned.current) void dispose(item) } }, [])
  async function addMore() {
    if (operation.current) return
    operation.current = true; setBusy(true); setError('')
    try {
      const file = await pickDocument()
      if (!file) return
      if (!alive.current) { await file.dispose?.(); return }
      const item = { key: randomUUID(), file }; update([...owned.current, item]); setSelected(item.key)
    } catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { operation.current = false; if (alive.current) setBusy(false) }
  }
  function remove(item: Item) {
    void dispose(item); const next = owned.current.filter(i => i.key !== item.key)
    update(next); if (!next.length) onClose(); else setSelected(next[0].key)
  }
  async function send() {
    if (operation.current || !owned.current.length) return
    operation.current = true; setBusy(true); setError('')
    try {
      for (const item of owned.current) { const invalid = uploadLimitError(item.file); if (invalid) throw Error(invalid) }
      setStatus('Saving on this device...')
      await onSend(owned.current, caption, clientId.current)
    } catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { operation.current = false; if (alive.current) { setBusy(false); setStatus('') } }
  }

  if (!current) return null
  const image = current.file.mime.startsWith('image/')
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose() }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.dark ? '#0b141a' : '#efeae2', paddingTop: inset.top, paddingBottom: Math.max(inset.bottom, 12) }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8 }}>
        <IconButton name="x" label="Close and discard files" disabled={busy} onPress={onClose} />
        <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 14 }}>{current.file.name}</Text>
        {image && current.file.mime !== 'image/gif' && <IconButton name="pencil" label="Edit image" disabled={busy} onPress={() => setEditing(true)} />}
      </View>
      <View style={{ flex: 1, minHeight: 100, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
        {image ? <Image source={{ uri: current.file.uri }} accessibilityLabel={current.file.name} resizeMode="contain" style={{ width: '100%', height: '100%', borderRadius: 16 }} /> :
          <View style={{ padding: 32, borderRadius: 16, backgroundColor: c.shell, alignItems: 'center', gap: 16, maxWidth: 320 }}><Icon name="fileText" size={56} color={c.brand} /><Text style={{ color: c.text, textAlign: 'center', fontSize: 16 }}>{current.file.name}</Text><Text style={{ color: c.muted }}>{current.file.name.split('.').pop()?.toUpperCase()} · {current.file.size < 1024 ? `${current.file.size} B` : `${(current.file.size / 1024).toFixed(1)} KB`}</Text></View>}
      </View>
      {busy && <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 8 }}><ActivityIndicator color={c.brand} /><Text style={{ color: c.text }}>{status || 'Opening files…'}</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={{ color: c.text, padding: 12, textAlign: 'center' }}>{error}</Text>}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}><TextInput selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent" accessibilityLabel="Attachment caption" placeholder="Add a caption" placeholderTextColor={c.muted} value={caption} onChangeText={v => { setCaption(v); clientId.current = randomUUID() }} editable={!busy} maxLength={4000} multiline style={{ minHeight: 48, maxHeight: 120, color: c.text, fontSize: 16, backgroundColor: c.shell, borderWidth: 1, borderColor: c.border, borderRadius: 24, paddingHorizontal: 16, paddingStart: 16, paddingEnd: 16, paddingVertical: 12 }} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderColor: c.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }} style={{ flex: 1 }}>
          {items.map(item => <View key={item.key}><Pressable accessibilityRole="button" accessibilityLabel={`Preview ${item.file.name}`} disabled={busy} onPress={() => setSelected(item.key)} style={{ width: 60, height: 60, borderRadius: 10, borderWidth: 2, borderColor: item.key === current.key ? c.brand : c.border, backgroundColor: c.shell, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{item.file.mime.startsWith('image/') ? <Image source={{ uri: item.file.uri }} style={{ width: '100%', height: '100%' }} /> : <Icon name="fileText" />}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.file.name}`} disabled={busy} onPress={() => remove(item)} hitSlop={8} style={{ position: 'absolute', top: -6, right: -3, backgroundColor: c.shell, borderRadius: 12, padding: 3 }}><Icon name="x" size={16} /></Pressable></View>)}
        </ScrollView>
        <IconButton name="plus" label="Add more files" disabled={busy} onPress={() => void addMore()} />
        <IconButton name={error ? 'refreshCw' : 'send'} label={error ? 'Retry sending files' : 'Send files'} primary disabled={busy} onPress={() => void send()} />
      </View>
      {editing && <PhotoEditor asset={current.file} onClose={() => setEditing(false)} onApply={file => { const old = current; const key = randomUUID(); update(owned.current.map(i => i.key === old.key ? { key, file } : i)); setSelected(key); setEditing(false); void dispose(old) }} />}
    </KeyboardAvoidingView>
  </Modal>
}
