import { useEffect,useRef,useState } from 'react'
import { Image, Platform, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { pickDocument } from '../modules/messenger/media/picker'
import { uploadAttachment } from '../modules/messenger/media/upload'
import { getConversation,updateGroup,type ConversationDetail } from '../modules/messenger/api'
import { validateProfileImage } from '../modules/profile/imagePolicy'
import type { PickedFile } from '../modules/messenger/media/model'
import { SelectionLease } from '../shared/selectionLease'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { errorMessage,origin } from '../core/api/client'
import { mediaUrl } from '../modules/messenger/media/url'
import { Button,Label } from '../ui'
import { ChatAvatar } from './ChatAvatar'
import { ToolButton } from './InboxVaultKit'
import { PhotoEditor } from './PhotoEditor'
export function GroupPhoto({detail,onChanged}:{detail:ConversationDetail;onChanged:()=>void}){
 const externalPicker=useRef(false)
 const [file,setFile]=useState<PickedFile|null>(null);const [editing,setEditing]=useState(false);const [remove,setRemove]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [selection]=useState(()=>new SelectionLease(()=>setError('Temporary group photo cleanup failed.')));const abort=useRef<AbortController|null>(null);const generation=useRef(0)
 useEffect(()=>{const clear=()=>{generation.current++;abort.current?.abort();selection.invalidate();setFile(null);setEditing(false);setRemove(false)};const off=subscribeSensitiveView(active=>{if(!active && !(Platform.OS !== 'web' && externalPicker.current))clear()});return()=>{off();clear()}},[selection])
 async function choose(){externalPicker.current=true;const token=selection.begin();setError('');let asset:PickedFile|null=null;try{asset=await pickDocument(['image/jpeg','image/png','image/webp','image/gif']);if(!asset)return;validateProfileImage(asset,'avatar');if(selection.accept(token,asset)){setFile(asset);setRemove(false)}}catch(e){await asset?.dispose?.();setError(errorMessage(e))}finally{externalPicker.current=false}}
 async function save(){if(busy)return;const token=++generation.current;const controller=new AbortController();abort.current=controller;setBusy(true);setError('');try{const fresh=await getConversation(detail.id);if(!fresh.can.edit_info)throw Error('Editing this group is no longer allowed.');let id='';if(!remove&&file)id=(await uploadAttachment(file,randomUUID(),controller.signal,()=>{},'group_avatar')).id;if(controller.signal.aborted||token!==generation.current)return;await updateGroup(detail.id,{avatar_upload_id:id},controller.signal);if(token===generation.current){selection.invalidate();setFile(null);setRemove(false);onChanged()}}catch(e){if(token===generation.current)setError(errorMessage(e))}finally{if(abort.current===controller)abort.current=null;setBusy(false)}}
 const uri=file?.uri??mediaUrl(detail.avatar_url,origin)
 return <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>{uri ? <Image source={{uri}} accessibilityLabel="Group photo preview" style={{width:120,height:120,borderRadius:60}}/> : <ChatAvatar name={detail.title} seed={detail.id} size={120} />}<View style={{ flexDirection: 'row', gap: 8 }}><ToolButton icon="camera" label="Change photo" a11y="Choose group photo" disabled={busy} onPress={()=>void choose()}/>{!!detail.avatar_url && <ToolButton iconOnly icon="trash2" danger label="Remove group photo" disabled={busy} onPress={()=>{selection.invalidate();setFile(null);setRemove(true)}}/>}</View>{!!error&&<Label>{error}</Label>}{file&&<Button title="Edit group photo" disabled={busy} onPress={()=>setEditing(true)}/>}{(file||remove)&&<><Label>{remove?'Remove this group photo?':'Save the selected photo for this group?'}</Label><Button title="Confirm group photo" disabled={busy} onPress={()=>void save()}/><Button title="Cancel group photo" onPress={()=>{generation.current++;abort.current?.abort();selection.invalidate();setFile(null);setRemove(false)}}/></>}{editing&&file&&<PhotoEditor asset={file} onClose={()=>setEditing(false)} onApply={asset=>{try{validateProfileImage(asset,'avatar')}catch(e){void Promise.resolve(asset.dispose?.()).catch(()=>setError('Temporary edited image cleanup failed.'));setError(errorMessage(e));return}if(selection.accept(selection.begin(),asset)){setFile(asset);setEditing(false)}}}/>}</View>
}
