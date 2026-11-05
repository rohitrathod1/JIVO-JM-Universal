import { SelectionLease } from '../shared/selectionLease'
import { PhotoEditor } from './PhotoEditor'
import { useEffect, useRef, useState } from 'react'
import { Image, Platform, Pressable, Text, View } from 'react-native'
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
import { Button, Field, radius, useColors } from '../ui'
import { ChatAvatar } from './ChatAvatar'
import { IconTextButton } from './AdminUi'
import { ProfileSection, mutedText } from './ProfileSection'
export function ProfileImages({ part = 'photo' }: { part?: 'photo' | 'background' }) {
 const [editing,setEditing]=useState(false);
 const {me,adopt}=useSession();const appearance=useChatAppearance();const [file,setFile]=useState<{asset:PickedFile;purpose:'avatar'|'background'}|null>(null);const [color,setColor]=useState('#E7F3EC');const [review,setReview]=useState<'photo'|'remove-photo'|'color'|'default'|'remove-background'|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const abort=useRef<AbortController|null>(null);const generation=useRef(0);const active=useRef(true);const mounted=useRef(true)
 const externalPicker=useRef(false)
 const [selection]=useState(()=>new SelectionLease(()=>setError('A temporary selected image could not be removed.')))
 useEffect(()=>{const invalidate=()=>{generation.current++;abort.current?.abort();selection.invalidate()};mounted.current=true;active.current=true;const off=subscribeSensitiveView(value=>{active.current=value;if(!value && !(Platform.OS !== 'web' && externalPicker.current)){invalidate();setFile(null);setReview(null);setEditing(false)}});return()=>{mounted.current=false;active.current=false;invalidate();off()}},[selection])
 async function pick(purpose:'avatar'|'background'){externalPicker.current=true;const token=selection.begin();setError('');let asset:PickedFile|null=null;try{asset=await pickDocument(['image/jpeg','image/png','image/webp','image/gif']);if(!asset)return;validateProfileImage(asset,purpose);if(!selection.accept(token,asset))return;setFile({asset,purpose});setReview('photo')}catch(e){await asset?.dispose?.();if(mounted.current)setError(errorMessage(e))}finally{externalPicker.current=false}}
 async function save(){if(busy||!review)return;const token=++generation.current;const controller=new AbortController();abort.current=controller;setBusy(true);setError('');setNotice('');try{if(review==='photo'&&file){const upload=await uploadAttachment(file.asset,randomUUID(),controller.signal,()=>{},file.purpose);if(!active.current||generation.current!==token||controller.signal.aborted)return;if(file.purpose==='avatar')await setMyPhoto(upload.id,controller.signal);else await setAppearance({type:'image',upload_id:upload.id},controller.signal)}else if(review==='remove-photo')await removeMyPhoto(controller.signal);else if(review==='color')await setAppearance({type:'color',color},controller.signal);else if(review==='default')await setAppearance({type:'default'},controller.signal);else if(review==='remove-background')await removeAppearanceImage(controller.signal);if(active.current&&generation.current===token){selection.invalidate();setReview(null);setFile(null);setNotice('Image or appearance updated.');await adopt();appearance.refresh()}}catch(e){if(active.current)setError(errorMessage(e))}finally{if(abort.current===controller)abort.current=null;if(mounted.current)setBusy(false)}}
 const avatar=mediaUrl(me?.avatar_url,origin);const image=mediaUrl(appearance.value?.image_url,origin);const c=useColors()
 const status=<>{!!error&&<Text accessibilityRole="alert" style={{...mutedText(c.danger),fontSize:13}}>{error}</Text>}{!!notice&&<Text style={{...mutedText(c.success),fontSize:13}}>{notice}</Text>}</>
 const pending=(purpose:'avatar'|'background')=>review&&(purpose==='avatar'?(review==='remove-photo'||(review==='photo'&&file?.purpose==='avatar')):!(review==='remove-photo'||(review==='photo'&&file?.purpose==='avatar')))
 const reviewBox=(purpose:'avatar'|'background')=>pending(purpose)&&<View style={{gap:8}}><Text role="status" style={{...mutedText(c.warning),fontFamily:'Inter_500Medium'}}>{review==='photo'?'Save '+file?.asset.name+(file?.purpose==='background'?' as everyone’s chat background?':' as your profile photo?'):review==='remove-photo'?'Remove your profile photo?':'Apply this organization-wide background change?'}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{review==='photo'&&file&&<Button size="sm" variant="secondary" title="Edit" accessibilityLabel="Edit selected image" disabled={busy} onPress={()=>setEditing(true)}/>}<Button size="sm" title="Save" accessibilityLabel="Confirm image change" loading={busy} onPress={()=>void save()}/><Button size="sm" variant="ghost" title="Undo" accessibilityLabel={busy?'Cancel image upload':'Cancel image change'} onPress={()=>{generation.current++;abort.current?.abort();selection.invalidate();setReview(null);setFile(null);setEditing(false)}}/></View></View>
 const editor=editing&&file&&<PhotoEditor asset={file.asset} onClose={()=>setEditing(false)} onApply={asset=>{try{validateProfileImage(asset,file.purpose)}catch(e){void Promise.resolve(asset.dispose?.()).catch(()=>setError('Temporary edited image cleanup failed.'));setError(errorMessage(e));return}if(selection.accept(selection.begin(),asset)){setFile({...file,asset});setEditing(false)}}}/>
 if(part==='photo')return <View style={{gap:8}}>
  <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:16}}>
   <Pressable accessibilityRole="button" accessibilityLabel="Change photo" disabled={busy} onPress={()=>void pick('avatar')} style={{borderRadius:44,...(Platform.OS==='web'?{cursor:'pointer'} as object:{})}}>
    {avatar?<Image accessibilityLabel="Current profile photo" source={{uri:avatar}} style={{width:88,height:88,borderRadius:44}}/>:<ChatAvatar name={me?.name??''} seed={me?.id} size={88}/>}
   </Pressable>
   <View style={{gap:8,flexShrink:1}}>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><IconTextButton icon="camera" size="sm" variant="secondary" title={avatar?'Change photo':'Add photo'} accessibilityLabel="Choose profile photo" disabled={busy} onPress={()=>void pick('avatar')}/>{!!me?.avatar_url&&<IconTextButton icon="trash2" size="sm" variant="ghost" title="Remove" accessibilityLabel="Remove profile photo" disabled={busy} onPress={()=>setReview('remove-photo')}/>}</View>
   </View>
  </View>
  {reviewBox('avatar')}{status}{editor}
 </View>
 if(!me?.capabilities.includes('ADMIN_USERS'))return null
 const valid=/^#[0-9a-f]{6}$/i.test(color)
 return <ProfileSection title="Chat background"><View style={{gap:12}}>
  <Text style={{...mutedText(c.muted),fontSize:14,lineHeight:20}}>This changes the background for everyone.</Text>
  {image&&<Image accessibilityLabel="Current chat background" source={{uri:image}} style={{width:'100%',height:120,borderRadius:radius.control}}/>}
  <View style={{flexDirection:'row',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}><View style={{width:160}}><Field label="Chat background color" value={color} onChangeText={setColor} maxLength={7}/></View><View style={{width:40,height:40,borderRadius:radius.control,borderWidth:1,borderColor:c.border,backgroundColor:valid?color:undefined}}/><Button size="sm" variant="secondary" title="Use this color" accessibilityLabel="Review background color" disabled={busy||!valid} onPress={()=>setReview('color')}/></View>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><Button size="sm" variant="secondary" title="Choose image" accessibilityLabel="Choose chat background image" disabled={busy} onPress={()=>void pick('background')}/><Button size="sm" variant="ghost" title="Restore default" accessibilityLabel="Restore default chat background" disabled={busy} onPress={()=>setReview('default')}/>{!!appearance.value?.image_url&&<Button size="sm" variant="ghost" title="Remove image" accessibilityLabel="Remove saved background image" disabled={busy} onPress={()=>setReview('remove-background')}/>}</View>
  <Text style={mutedText(c.muted)}>Background images: up to 8 MB.</Text>
  {reviewBox('background')}{status}{editor}
 </View></ProfileSection>
}
