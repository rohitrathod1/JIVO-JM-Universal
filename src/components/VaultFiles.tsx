import { SafeAreaView } from 'react-native-safe-area-context'
import { ImageViewer } from './ImageViewer'
import { Icon } from './Icon'
import { ToolButton, Muted, font, dateLabel } from './InboxVaultKit'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native'
import * as vault from '../modules/passwords/api'
import { cancelVaultExports, canSaveVaultFile, pickVaultFile, saveVaultFile, validateVaultExportSize, vaultExportNotice } from '../modules/passwords/files/transfer'
import { previewDuration, validateVaultFile } from '../modules/passwords/files/model'
import { SensitiveRequestGuard } from '../shared/sensitive'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { useResource } from '../shared/useResource'
import { errorMessage } from '../core/api/client'
import { Button, Field, Label, useColors } from '../ui'
import { VaultSheet as Sheet } from './VaultSheet'
export function VaultFiles({ vaultId }: { vaultId: string }) {
 const colors = useColors()
 const load = useCallback(() => vault.listVaultFiles(vaultId), [vaultId]); const resource = useResource(load)
 const [reading,setReading] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [progress,setProgress] = useState<number | null>(null)
 const [preview,setPreview] = useState<{name:string;text?:string;uri?:string} | null>(null)
 const [action,setAction] = useState<{kind:'rename'|'delete'|'download';file:vault.VaultFile} | null>(null); const [name,setName] = useState('')
 const guard = useRef(new SensitiveRequestGuard()); const abort = useRef<AbortController | null>(null); const active = useRef(true)
 const clear = useCallback(() => { guard.current.clear(); setPreview(null) }, [])
 useEffect(() => { active.current=true; const current=guard.current; const off=subscribeSensitiveView(value => { current.setActive(value); if(!value) { setPreview(null); abort.current?.abort() } }); return () => { active.current=false; current.setActive(false); abort.current?.abort(); cancelVaultExports(); off() } }, [])
 const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
 useEffect(() => () => clearTimeout(timer.current), [])
 async function fresh(permission: keyof vault.VaultFiles['can'], id?:string, signal?:AbortSignal) { const current=await vault.listVaultFiles(vaultId,signal); if(!current.can.list || !current.can[permission] || id && !current.results.some(f=>f.id===id)) throw Error('This file action is no longer allowed.'); return current }
 async function run(work:()=>Promise<void>) { if(busy)return;setBusy(true);setError('');try { await work() } catch(e) { if(active.current) setError(errorMessage(e)) } finally { if(active.current){setBusy(false);setProgress(null)} } }
 async function read(work:(signal:AbortSignal)=>Promise<void>) {
  const controller=new AbortController();abort.current=controller;setReading(true)
  try { await work(controller.signal) } catch(e) { if(controller.signal.aborted)throw Error('File transfer cancelled.');throw e }
  finally { if(abort.current===controller)abort.current=null;if(active.current)setReading(false) }
 }
 const cancelRead=()=>{abort.current?.abort();cancelVaultExports();clear()}
 const canPreviewImage = (name: string) => /\.(png|jpe?g|webp|gif)$/i.test(name)
 async function openFile(file: vault.VaultFile) {
  if (!file.previewable && !canPreviewImage(file.name)) { setAction({ kind: 'download', file }); return }
  await run(() => read(async signal => {
   const generation = guard.current.begin(); await fresh('download', file.id, signal)
   if (canPreviewImage(file.name)) {
    validateVaultExportSize(file.size)
    const blob = await vault.downloadVaultFile(file.id, signal)
    validateVaultExportSize(blob.size)
    const extension = file.name.split('.').pop()!.toLowerCase()
    const type = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`
    const uri = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('This image could not be opened.')); reader.readAsDataURL(blob.slice(0, blob.size, type)) })
    if (!guard.current.accepts(generation) || signal.aborted) return
    clearTimeout(timer.current); setPreview({ name: file.name, uri }); timer.current = setTimeout(clear, 60000)
   } else {
    const value = await vault.previewVaultFile(file.id, signal)
    if (!guard.current.accepts(generation)) return
    const duration = previewDuration(value.expires_in); if (!duration) throw Error('The preview has expired.')
    clearTimeout(timer.current); setPreview({ name: value.name, text: value.text }); timer.current = setTimeout(clear, duration)
   }
  }))
 }
 const can=resource.value?.can
 return <View style={{gap:12}}><Muted size={14}>Keystores, certificates and config files. Encrypted with the vault keys; up to {((resource.value?.max_bytes ?? 0) / 1024 / 1024).toFixed(1)} MB each.</Muted>
 {!!(error || resource.error) && <Text accessibilityRole="alert" style={{color:colors.text}}>{error || errorMessage(resource.error)}</Text>}
 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
 {can?.upload && <ToolButton icon="upload" variant="primary" label="Upload" a11y="Upload vault file" disabled={busy} onPress={() => void run(async()=>{
  const file=await pickVaultFile(resource.value!.max_bytes);if(!file || !active.current)return
  const generation=guard.current.begin();const current=await fresh('upload');if(!guard.current.accepts(generation))return;validateVaultFile(file.name,file.body.size,current.max_bytes)
  const controller=new AbortController();abort.current=controller;setProgress(0)
  try {await vault.uploadVaultFile(vaultId,file.body,setProgress,controller.signal,file.name);if(active.current)resource.refresh()} finally {abort.current=null}
 })} />}
 {(busy || resource.loading) && <ActivityIndicator size="small" color={colors.brand} />}
 {progress !== null && <Muted>{Math.round(progress * 100)}%</Muted>}
 {(reading || progress !== null) && <ToolButton iconOnly variant="ghost" icon="x" label="Cancel file transfer" height={32} onPress={cancelRead} />}
 </View>
 {can?.list && resource.value?.results.map(file=><View key={file.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}><Icon name="fileKey" size={20} color={colors.brand} /><Pressable accessibilityRole="button" accessibilityLabel={`Open file ${file.name}`} disabled={busy || !can.download} onPress={() => void openFile(file)} style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.text, fontFamily: font.m, fontSize: 14 }}>{file.name}</Text><Muted lines={2}>{(file.size / 1024 / 1024).toFixed(1)} MB {'\u00b7'} {file.created_by.name} {'\u00b7'} {dateLabel(file.created_at)}</Muted></Pressable>
 {can.download && canSaveVaultFile && <ToolButton height={32} iconOnly variant="ghost" icon="download" label={`Download file ${file.name}`} disabled={busy} onPress={()=>setAction({kind:'download',file})} />}
 {can.rename && <ToolButton height={32} iconOnly variant="ghost" icon="pencil" label={`Rename file ${file.name}`} disabled={busy} onPress={()=>{setName(file.name);setAction({kind:'rename',file})}} />}
 {can.delete && <ToolButton height={32} iconOnly variant="ghost" danger icon="trash2" label={`Delete file ${file.name}`} disabled={busy} onPress={()=>setAction({kind:'delete',file})} />}</View>)}
 {can?.download && !canSaveVaultFile && <Label>Native file export is not configured. Use the web client to download; temporary text previews are available here.</Label>}
 <Sheet title={preview?.name} visible={Boolean(preview && !preview.uri)} onClose={clear}><Label>Temporary decrypted preview. Closes on background or expiry.</Label><Text selectable style={{color:colors.text,fontFamily:'Inter_400Regular'}}>{preview?.text}</Text></Sheet>
 <Sheet title={action?.kind === 'rename' ? 'Rename file' : action?.kind === 'delete' ? 'Delete file?' : 'Export file'} closeDisabled={busy} footer={<><Button title={action?.kind === 'rename' ? 'Save' : action?.kind === 'delete' ? 'Delete' : 'Export'} size="sm" variant={action?.kind === 'delete' ? 'danger' : 'primary'} disabled={busy || action?.kind==='rename' && (!name.trim() || name.trim() === action.file.name)} onPress={()=>void run(async()=>{if(!action)return;const generation=guard.current.begin();if(action.kind!=='download')await fresh(action.kind,action.file.id);if(action.kind==='download' && !guard.current.accepts(generation))return;if(action.kind==='rename'){if(/[\r\n\x00]/.test(name))throw Error('Enter a valid file name.');await vault.renameVaultFile(action.file.id,name.trim())}else if(action.kind==='delete'){await vault.deleteVaultFile(action.file.id);clear()}else{await read(async(signal)=>{const available=await fresh('download',action.file.id,signal);validateVaultExportSize(available.results.find(file=>file.id===action.file.id)!.size);const blob=await vault.downloadVaultFile(action.file.id,signal);if(!guard.current.accepts(generation))return;await saveVaultFile(blob,action.file.name,()=>guard.current.accepts(generation))})}setAction(null);resource.refresh()})} />{reading && <ToolButton iconOnly variant="ghost" icon="x" label="Cancel current file download" onPress={cancelRead} />}<Button title="Cancel" size="sm" variant="secondary" disabled={busy} onPress={()=>{setAction(null);setError('')}} /></>} visible={Boolean(action)} onClose={()=>{if(!busy)setAction(null)}}>{action?.kind !== 'rename' && <Label>{action?.file.name}</Label>}{action?.kind === 'delete' && <Muted>This file will be permanently deleted.</Muted>}{action?.kind==='rename' && <Field label="Name" value={name} onChangeText={setName} maxLength={255} />}{action?.kind==='download' && <Label>{vaultExportNotice}</Label>}
 {!!error && <Text accessibilityRole="alert" style={{color:colors.text}}>{error}</Text>}</Sheet>
 {preview?.uri && <Modal visible onRequestClose={clear} presentationStyle="fullScreen"><SafeAreaView style={{ flex: 1, backgroundColor: '#080d10' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 }}><Pressable accessibilityRole="button" accessibilityLabel="Close file preview" onPress={clear} style={{ padding: 12 }}><Icon name="back" color="#ffffff" /></Pressable><Text numberOfLines={1} style={{ color: '#ffffff', flex: 1 }}>{preview.name}</Text></View><ImageViewer uri={preview.uri} name={preview.name} /></SafeAreaView></Modal>}
 </View>
}
