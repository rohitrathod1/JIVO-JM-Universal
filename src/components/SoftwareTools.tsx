import { useCallback, useEffect, useState } from 'react'
import { Linking, Platform, Pressable, Switch, Text, View } from 'react-native'
import { useSession } from '../core/auth/Session'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { listTools, saveTool, hideTool, type SoftwareTool, type ToolInput } from '../modules/tools/api'
import { safeToolLink } from '../modules/tools/links'
import { Button, Card, EmptyState, Field, Label, Spinner, useColors } from '../ui'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
const empty: ToolInput = { name: '', description: '', web_url: '', app_url: '', position: 0, is_active: true }
export function SoftwareTools({ manage = false }: { manage?: boolean }) {
  const c = useColors(); const { me } = useSession()
  const allowed = !!me?.capabilities.includes(manage ? 'ADMIN_USERS' : 'JM_ACCESS')
  const load = useCallback(() => allowed ? listTools(manage) : Promise.resolve([]), [allowed, manage]); const resource = useResource(load)
  const [editor, setEditor] = useState<{ id: string | null; data: ToolInput } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => { const timer = setInterval(resource.refresh, 30000); return () => clearInterval(timer) }, [resource.refresh])
  if (!allowed) return <Label>You do not have access to this page.</Label>
  async function open(tool: SoftwareTool) {
    setError('')
    try {
      if (!safeToolLink(tool.web_url)) throw Error('This website link is invalid. Ask your administrator to update it.')
      if (Platform.OS === 'web') { window.open(tool.web_url, '_blank', 'noopener,noreferrer'); return }
      if (tool.app_url && safeToolLink(tool.app_url, true)) { try { await Linking.openURL(tool.app_url); return } catch { /* Fall back to the website when the app is not installed. */ } }
      await Linking.openURL(tool.web_url)
    } catch (e) { setError(errorMessage(e)) }
  }
  async function save() {
    if (!editor || busy) return
    setBusy(true); setError('')
    try { if (!editor.data.name.trim() || !safeToolLink(editor.data.web_url) || editor.data.app_url && !safeToolLink(editor.data.app_url, true)) throw Error('Enter a name, an HTTPS website, and a valid optional app link.'); await saveTool(editor.id, { ...editor.data, name: editor.data.name.trim() }); setEditor(null); resource.refresh() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <View style={{ gap: 16 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label large>{manage ? 'Software tools' : 'JIVO tools'}</Label>{manage && <Button title="Add software" onPress={() => { setError(''); setEditor({ id: null, data: { ...empty } }) }} />}</View>
    <Text style={{ color: c.muted, fontSize: 14 }}>{manage ? 'Manage the software links available to your team.' : 'Open your other JIVO apps and websites.'}</Text>
    {!!(error || resource.error) && <Label>{error || errorMessage(resource.error)}</Label>}
    {resource.loading && !resource.value && <Spinner label="Loading tools" />}
    {resource.value?.length === 0 && <EmptyState title="No tools added yet" description={manage ? 'Add HO, JI or another software using its real link.' : 'Your administrator can add software here.'} />}
    {resource.value?.map(tool => <Card key={tool.id}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${tool.name}`} onPress={() => void open(tool)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.brand, fontSize: 18, fontWeight: '700' }}>{tool.name.slice(0, 2).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{tool.name}{!tool.is_active ? ' (Hidden)' : ''}</Text>{!!tool.description && <Text style={{ color: c.muted, fontSize: 14 }}>{tool.description}</Text>}</View><Icon name="externalLink" color={c.muted} size={20} /></Pressable>
      {manage && <View style={{ flexDirection: 'row', gap: 12 }}><Button title={`Edit ${tool.name}`} size="sm" variant="secondary" onPress={() => { setError(''); setEditor({ id: tool.id, data: { ...tool } }) }} />{tool.is_active && <Button title={`Hide ${tool.name}`} size="sm" variant="ghost" disabled={busy} onPress={() => { setBusy(true); void hideTool(tool.id).then(resource.refresh).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} />}</View>}
    </Card>)}
    <Sheet stableForm visible={!!editor} onClose={() => { if (!busy) setEditor(null) }}><Label large>{editor?.id ? 'Edit software' : 'Add software'}</Label>{editor && <>
      {(['name', 'description', 'web_url', 'app_url'] as const).map(key => <Field inset style={{ fontSize: 16, minHeight: 52, paddingLeft: 16, paddingRight: 16, paddingStart: 16, paddingEnd: 16, paddingVertical: 12 }} key={key} label={{ name: 'Software name', description: 'Description', web_url: 'Website URL (HTTPS)', app_url: 'App link (optional)' }[key]} autoCapitalize={key.endsWith('url') ? 'none' : 'sentences'} autoCorrect={!key.endsWith('url')} value={editor.data[key]} onChangeText={value => setEditor({ ...editor, data: { ...editor.data, [key]: value } })} />)}
      <Field inset style={{ fontSize: 16, minHeight: 52, paddingLeft: 16, paddingRight: 16, paddingStart: 16, paddingEnd: 16, paddingVertical: 12 }} label="Display order" keyboardType="number-pad" value={String(editor.data.position)} onChangeText={value => { if (/^\d{0,5}$/.test(value)) setEditor({ ...editor, data: { ...editor.data, position: Number(value) } }) }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Label>Visible to users</Label><Switch accessibilityLabel="Visible to users" value={editor.data.is_active} onValueChange={value => setEditor({ ...editor, data: { ...editor.data, is_active: value } })} /></View>
      {!!error && <Label>{error}</Label>}<Button title="Save software" loading={busy} disabled={busy} onPress={() => void save()} /><Button title="Cancel" variant="ghost" disabled={busy} onPress={() => setEditor(null)} />
    </>}</Sheet>
  </View>
}
