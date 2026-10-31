import * as DocumentPicker from 'expo-document-picker'
import { Directory,File,Paths } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'
import type { PickedFile } from './model'
export async function pickDocument(type:string|string[]='*/*'):Promise<PickedFile|null>{
 const result=await DocumentPicker.getDocumentAsync({type,multiple:false,copyToCacheDirectory:false,base64:false});if(result.canceled)return null;const asset=result.assets[0]
 if(asset.size===undefined||!Number.isFinite(asset.size)||asset.size<0)throw Error('The document provider did not report a valid file size.')
 if(!asset.uri.startsWith('file://')&&!asset.uri.startsWith('content://'))throw Error('The provider did not return a local file.')
 const directory=new Directory(Paths.cache,'jivo-picker-'+randomUUID());directory.create();const extension=asset.name.match(/\.[a-z0-9]{1,12}$/i)?.[0]??'';const copy=new File(directory,'selected'+extension)
 const dispose=()=>{if(!directory.uri.startsWith(Paths.cache.uri))throw Error('Unexpected picker cache path.');if(directory.exists)directory.delete()}
 try{new File(asset.uri).copy(copy);return{name:asset.name,size:copy.size,mime:asset.mimeType||'application/octet-stream',uri:copy.uri,dispose}}catch(e){dispose();throw e}
}
