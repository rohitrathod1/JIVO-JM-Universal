import { useEffect,useState } from 'react'
import { View } from 'react-native'
import { useSession } from '../core/auth/Session'
import { cancelAttachmentExports,retryAttachmentCleanup,watchAttachmentCleanup } from '../modules/messenger/media/export'
import { Button,Label } from '../ui'
export function AttachmentExportStatus(){const [error,setError]=useState('');const {status,me}=useSession();useEffect(()=>watchAttachmentCleanup(setError),[]);useEffect(()=>{if(status!=='ready')cancelAttachmentExports();return cancelAttachmentExports},[status,me?.id,me?.session?.id]);return error?<View accessibilityRole="alert"><Label>{error}</Label><Button title="Retry attachment export cleanup" onPress={retryAttachmentCleanup}/></View>:null}
