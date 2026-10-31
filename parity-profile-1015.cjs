const fs=require('fs');function write(p,s){fs.writeFileSync(p,s)}function edit(p,a,b){let s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error(p+' '+a.slice(0,90));write(p,s.replace(a,b))}
for(const p of ['src/modules/messenger/media/form.ts','src/modules/messenger/media/form.native.ts']){edit(p,'uploadForm(asset: PickedFile)','uploadForm(asset: PickedFile, purpose: \'attachment\' | \'avatar\' | \'background\' = \'attachment\')');edit(p,"form.append('purpose', 'attachment')","form.append('purpose', purpose)")}
edit('src/modules/messenger/media/upload.ts','progress: (value: number) => void)','progress: (value: number) => void, purpose: \'attachment\' | \'avatar\' | \'background\' = \'attachment\')')
edit('src/modules/messenger/media/upload.ts','uploadForm(asset)','uploadForm(asset, purpose)')
edit('src/modules/messenger/media/upload.ts','timeout: 0,',"timeout: purpose === 'attachment' ? 0 : 120000,")
edit('src/modules/messenger/media/picker.ts','pickDocument():','pickDocument(type: string | string[] = \'*/*\'):')
edit('src/modules/messenger/media/picker.ts','{ multiple: false,','{ type, multiple: false,')
write('src/modules/profile/imagePolicy.ts',`import type { PickedFile } from '../messenger/media/model'
export function validateProfileImage(asset: PickedFile, purpose: 'avatar' | 'background') {
 if (!['image/jpeg','image/png','image/webp','image/gif'].includes(asset.mime)) throw Error('Choose a JPEG, PNG, WebP or GIF image.')
 const limit = (purpose==='avatar'?10:8)*1024*1024
 if(!Number.isFinite(asset.size)||asset.size<=0||asset.size>limit) throw Error('Choose an image of at most '+(purpose==='avatar'?10:8)+' MB.')
}
`)
write('src/components/ProfileImages.tsx',`import { useEffect, useRef, useState } from 'react'
import { Image, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { useSession } from '../core/auth/Session'
import { errorMessage, origin } from '../core/api/client'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { pickDocument } from '../modules/messenger/media/picker'
import { uploadAttachment } from '../modules/messenger/media/upload'
import type { PickedFile } from '../modules/messenger/media/model'
import { mediaUrl } from '../modules/messenger/media/url'
import { validateProfileImage } from '../modules/profile/imagePolicy'
import { setMyPhoto, removeMyPhoto } from '../modules/profile/api'
import { setAppearance, removeAppearanceImage } from '../modules/messenger/api'
import { useChatAppearance } from './ChatAppearance'
import { Button, Card, Field, Label } from '../ui'
export function ProfileImages() {
 const {me,adopt}=useSession();const appearance=useChatAppearance();const [file,setFile]=useState<{asset:PickedFile;purpose:'avatar'|'background'}|null>(null);const [color,setColor]=useState('#E7F3EC');const [review,setReview]=useState<'photo'|'remove-photo'|'color'|'default'|'remove-background'|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const abort=useRef<AbortController|null>(null);const generation=useRef(0);const active=useRef(true)
 useEffect(()=>{active.current=true;const off=subscribeSensitiveView(value=>{active.current=value;if(!value){generation.current++;abort.current?.abort();setFile(null);setReview(null)}});return()=>{active.current=false;generation.current++;abort.current?.abort();off()}},[])
 async function pick(purpose:'avatar'|'background'){const token=++generation.current;setError('');try{const asset=await pickDocument(['image/jpeg','image/png','image/webp','image/gif']);if(!asset||token!==generation.current||!active.current)return;validateProfileImage(asset,purpose);setFile({asset,purpose});setReview('photo')}catch(e){setError(errorMessage(e))}}
 async function save(){if(busy||!review)return;const token=++generation.current;const controller=new AbortController();abort.current=controller;setBusy(true);setError('');setNotice('');try{if(review==='photo'&&file){const upload=await uploadAttachment(file.asset,randomUUID(),controller.signal,()=>{},file.purpose);if(!active.current||generation.current!==token||controller.signal.aborted)return;if(file.purpose==='avatar')await setMyPhoto(upload.id,controller.signal);else await setAppearance({type:'image',upload_id:upload.id},controller.signal)}else if(review==='remove-photo')await removeMyPhoto(controller.signal);else if(review==='color')await setAppearance({type:'color',color},controller.signal);else if(review==='default')await setAppearance({type:'default'},controller.signal);else if(review==='remove-background')await removeAppearanceImage(controller.signal);if(active.current&&generation.current===token){setReview(null);setFile(null);setNotice('Image or appearance updated.');await adopt();appearance.refresh()}}catch(e){if(active.current)setError(errorMessage(e))}finally{abort.current=null;if(active.current)setBusy(false)}}
 const avatar=mediaUrl(me?.avatar_url,origin);const image=mediaUrl(appearance.value?.image_url,origin)
 return <Card><Label large>Photo & chat appearance</Label>{avatar&&<Image accessibilityLabel="Current profile photo" source={{uri:avatar}} style={{width:96,height:96,borderRadius:48}}/>}<Button title="Choose profile photo" disabled={busy} onPress={()=>void pick('avatar')}/><Button title="Remove profile photo" disabled={busy||!me?.avatar_url} onPress={()=>setReview('remove-photo')}/><Label>JPEG, PNG, WebP or GIF, up to 10 MB. Saving uploads the selected image for server checks.</Label>{me?.capabilities.includes('ADMIN_USERS')&&<><Label large>Organization chat background</Label><Label>This changes the background for everyone.</Label>{image&&<Image accessibilityLabel="Current chat background" source={{uri:image}} style={{width:'100%',height:120}}/>}<Field label="Chat background color" value={color} onChangeText={setColor} maxLength={7}/><View style={{height:40,backgroundColor:/^#[0-9a-f]{6}$/i.test(color)?color:undefined}}/><Button title="Review background color" disabled={busy||!/^#[0-9a-f]{6}$/i.test(color)} onPress={()=>setReview('color')}/><Button title="Choose chat background image" disabled={busy} onPress={()=>void pick('background')}/><Label>Background images: up to 8 MB.</Label><Button title="Restore default chat background" disabled={busy} onPress={()=>setReview('default')}/><Button title="Remove saved background image" disabled={busy||!appearance.value?.image_url} onPress={()=>setReview('remove-background')}/></>}{!!error&&<Label>{error}</Label>}{!!notice&&<Label>{notice}</Label>}{review&&<><Label>{review==='photo'?'Save '+file?.asset.name+(file?.purpose==='background'?' as everyone’s chat background?':' as your profile photo?'):review==='remove-photo'?'Remove your profile photo?':'Apply this organization-wide background change?'}</Label><Button title="Confirm image change" disabled={busy} onPress={()=>void save()}/><Button title={busy?'Cancel image upload':'Cancel image change'} onPress={()=>{generation.current++;abort.current?.abort();setReview(null);setFile(null)}}/></>}</Card>
}
`)
write('src/components/ChatAppearance.tsx',`import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSession } from '../core/auth/Session'
import { realtime } from '../core/realtime/socket'
import { getAppearance, type Appearance } from '../modules/messenger/api'
const Context=createContext<{value:Appearance|null;refresh:()=>void}>({value:null,refresh:()=>{}})
export const useChatAppearance=()=>useContext(Context)
export function ChatAppearance({children}:{children:ReactNode}){
 const {me,status}=useSession();const owner=status==='ready'&&me?.capabilities.includes('JM_ACCESS')?me.id:null;const [snapshot,setSnapshot]=useState<{owner:string;value:Appearance}|null>(null);const [revision,setRevision]=useState(0);const refresh=useCallback(()=>setRevision(v=>v+1),[])
 useEffect(()=>{if(!owner)return;let active=true;void getAppearance().then(value=>{if(active)setSnapshot({owner,value})}).catch(()=>{});const off=realtime.on<Appearance>('APPEARANCE_UPDATED',({data})=>{if(active)setSnapshot({owner,value:data})});const reconnect=realtime.on('RESYNC',refresh);return()=>{active=false;off();reconnect()}},[owner,revision,refresh])
 return <Context.Provider value={{value:owner&&snapshot?.owner===owner?snapshot.value:null,refresh}}>{children}</Context.Provider>
}
`)
edit('src/modules/profile/api.ts',"setMyPhoto = async (upload_id: string) => api.put('/me/avatar/', { upload_id })","setMyPhoto = async (upload_id: string, signal?: AbortSignal) => api.put('/me/avatar/', { upload_id }, { signal })")
edit('src/modules/profile/api.ts',"removeMyPhoto = async () => api.delete('/me/avatar/')","removeMyPhoto = async (signal?: AbortSignal) => api.delete('/me/avatar/', { signal })")
edit('src/modules/messenger/api.ts',"upload_id?: string }) =>\n  (await api.put<Appearance>('/admin/appearance/', data)).data","upload_id?: string }, signal?: AbortSignal) =>\n  (await api.put<Appearance>('/admin/appearance/', data, { signal })).data")
edit('src/modules/messenger/api.ts',"removeAppearanceImage = async () => (await api.delete<Appearance>('/admin/appearance/')).data","removeAppearanceImage = async (signal?: AbortSignal) => (await api.delete<Appearance>('/admin/appearance/', { signal })).data")
edit('src/app/_layout.tsx',"import { VaultExportStatus }", "import { ChatAppearance } from '../components/ChatAppearance'\nimport { VaultExportStatus }")
edit('src/app/_layout.tsx','<SessionProvider><VaultExportStatus','<SessionProvider><ChatAppearance><VaultExportStatus')
edit('src/app/_layout.tsx','</SessionProvider>','</ChatAppearance></SessionProvider>')
edit('src/components/ProfilePanel.tsx',"import { Sheet }", "import { ProfileImages } from './ProfileImages'\nimport { Sheet }")
edit('src/components/ProfilePanel.tsx','<Card><Label large>Sign-in email</Label>','<ProfileImages /><Card><Label large>Sign-in email</Label>')
edit('src/components/ConversationWorkspace.tsx',"import { MessageDetails }", "import { useChatAppearance } from './ChatAppearance'\nimport { mediaUrl } from '../modules/messenger/media/url'\nimport { MessageDetails }")
edit('src/components/ConversationWorkspace.tsx','const c = useColors();','const appearance = useChatAppearance().value; const backgroundImage = appearance?.type === \'image\' ? mediaUrl(appearance.image_url, origin) : null\n  const c = useColors();')
edit('src/components/ConversationWorkspace.tsx','<FlatList accessibilityLabel={readerAway',`<View style={{flex:1,backgroundColor:appearance?.type==='color' && /^#[0-9a-f]{6}$/i.test(appearance.color??'')?appearance.color!:undefined}}>{backgroundImage&&<Image pointerEvents="none" source={{uri:backgroundImage}} style={{position:'absolute',width:'100%',height:'100%',opacity:0.35}} resizeMode="cover"/>}<FlatList accessibilityLabel={readerAway`)
edit('src/components/ConversationWorkspace.tsx','</Card></Pressable>} />','</Card></Pressable>} /></View>')
console.log('Profile image and appearance source written')
