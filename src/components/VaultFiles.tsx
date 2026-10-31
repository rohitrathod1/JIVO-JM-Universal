import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import * as vault from '../modules/passwords/api'
import { cancelVaultExports, canSaveVaultFile, pickVaultFile, saveVaultFile, validateVaultExportSize, vaultExportNotice } from '../modules/passwords/files/transfer'
import { previewDuration, validateVaultFile } from '../modules/passwords/files/model'
import { SensitiveRequestGuard } from '../shared/sensitive'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { useResource } from '../shared/useResource'
import { errorMessage } from '../core/api/client'
import { Button, Card, Field, Label, useColors } from '../ui'
import { Sheet } from './Sheet'
export function VaultFiles({ vaultId }: { vaultId: string }) {
 const colors = useColors()
 const load = useCallback(() => vault.listVaultFiles(vaultId), [vaultId]); const resource = useResource(load)
 const [reading,setReading] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [progress,setProgress] = useState<number | null>(null)
 const [preview,setPreview] = useState<{name:string;text:string} | null>(null)
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
 const can=resource.value?.can
 return <View style={{gap:12}}><Label large>Vault files</Label><Label>Certificates, keystores and configuration files. Upload limit: {resource.value?.max_bytes ?? 0} bytes.</Label>
 {!!(error || resource.error) && <Text accessibilityRole="alert" style={{color:colors.text}}>{error || errorMessage(resource.error)}</Text>}{(busy || resource.loading) && <ActivityIndicator />}
 {reading && <Button title="Cancel vault file transfer" onPress={cancelRead} />}
 <Button title="Refresh vault files" disabled={busy} onPress={() => { clear();resource.refresh() }} />
 {can?.upload && <Button title="Upload vault file" disabled={busy} onPress={() => void run(async()=>{
  const file=await pickVaultFile(resource.value!.max_bytes);if(!file || !active.current)return
  const generation=guard.current.begin();const current=await fresh('upload');if(!guard.current.accepts(generation))return;validateVaultFile(file.name,file.body.size,current.max_bytes)
  const controller=new AbortController();abort.current=controller;setProgress(0)
  try {await vault.uploadVaultFile(vaultId,file.body,setProgress,controller.signal,file.name);if(active.current)resource.refresh()} finally {abort.current=null}
 })} />}
 {progress!==null && <><Label>Uploading: {Math.round(progress*100)}%</Label><Button title="Cancel vault file upload" onPress={()=>abort.current?.abort()} /></>}
 {can?.list && resource.value?.results.map(file=><Card key={file.id}><Label large>{file.name}</Label><Label>{file.size} bytes · {file.created_by.name}</Label>
 {can.download && file.previewable && <Button title={`Preview file ${file.name}`} disabled={busy} onPress={()=>void run(()=>read(async(signal)=>{const generation=guard.current.begin();await fresh('download',file.id,signal);const value=await vault.previewVaultFile(file.id,signal);if(!guard.current.accepts(generation))return;const duration=previewDuration(value.expires_in);if(!duration)throw Error('The preview has expired.');clearTimeout(timer.current);setPreview({name:value.name,text:value.text});timer.current=setTimeout(clear,duration)}))} />}
 {can.download && canSaveVaultFile && <Button title={`Download file ${file.name}`} disabled={busy} onPress={()=>setAction({kind:'download',file})} />}
 {can.rename && <Button title={`Rename file ${file.name}`} disabled={busy} onPress={()=>{setName(file.name);setAction({kind:'rename',file})}} />}
 {can.delete && <Button title={`Delete file ${file.name}`} disabled={busy} onPress={()=>setAction({kind:'delete',file})} />}</Card>)}
 {can?.download && !canSaveVaultFile && <Label>Native file export is not configured. Use the web client to download; temporary text previews are available here.</Label>}
 <Sheet visible={Boolean(preview)} onClose={clear}><Label large>{preview?.name}</Label><Label>Temporary decrypted preview. Closes on background or expiry.</Label><Text selectable style={{color:colors.text,fontFamily:'Inter_400Regular'}}>{preview?.text}</Text><Button title="Close file preview" onPress={clear} /></Sheet>
 <Sheet visible={Boolean(action)} onClose={()=>{if(!busy)setAction(null)}}><Label large>Confirm file {action?.kind}</Label><Label>{action?.file.name}</Label>{action?.kind==='rename' && <Field label="New vault file name" value={name} onChangeText={setName} maxLength={255} />}{action?.kind==='download' && <Label>{vaultExportNotice}</Label>}
 {!!error && <Text accessibilityRole="alert" style={{color:colors.text}}>{error}</Text>}<Button title="Confirm vault file action" disabled={busy || action?.kind==='rename' && !name.trim()} onPress={()=>void run(async()=>{if(!action)return;const generation=guard.current.begin();if(action.kind!=='download')await fresh(action.kind,action.file.id);if(action.kind==='download' && !guard.current.accepts(generation))return;if(action.kind==='rename'){if(/[\r\n\x00]/.test(name))throw Error('Enter a valid file name.');await vault.renameVaultFile(action.file.id,name.trim())}else if(action.kind==='delete'){await vault.deleteVaultFile(action.file.id);clear()}else{await read(async(signal)=>{const available=await fresh('download',action.file.id,signal);validateVaultExportSize(available.results.find(file=>file.id===action.file.id)!.size);const blob=await vault.downloadVaultFile(action.file.id,signal);if(!guard.current.accepts(generation))return;await saveVaultFile(blob,action.file.name,()=>guard.current.accepts(generation))})}setAction(null);resource.refresh()})} />{reading && <Button title="Cancel current file download" onPress={cancelRead} />}<Button title="Cancel vault file action" disabled={busy} onPress={()=>{setAction(null);setError('')}} /></Sheet>
 </View>
}
