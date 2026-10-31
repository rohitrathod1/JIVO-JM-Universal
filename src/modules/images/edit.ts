import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { File, Paths } from 'expo-file-system'
import type { PickedFile } from '../messenger/media/model'
import { cropPixels, type ImageEdit } from './model'
export const imageFramesSupported=true
export const framesNeedRender=true
export async function editImage(asset:PickedFile,edit:ImageEdit):Promise<PickedFile>{
 if(edit.frame!=='none')throw Error('Frame effects require the native frame renderer.')
 if(!asset.uri.startsWith('file://')&&!asset.uri.startsWith('content://'))throw Error('Choose a local image.')
 const context=ImageManipulator.manipulate(asset.uri);let source;let result;let cleanup:(()=>void)|undefined
 try{source=await context.renderAsync();const crop=cropPixels(source.width,source.height,edit);context.reset().rotate(edit.rotation);if(edit.flipX)context.flip('horizontal');if(edit.flipY)context.flip('vertical');context.crop(crop);if(edit.zoom!==1||Math.max(crop.width,crop.height)>2000)context.resize(crop.width>=crop.height?{width:Math.min(2000,Math.round(crop.width*edit.zoom))}:{height:Math.min(2000,Math.round(crop.height*edit.zoom))});result=await context.renderAsync();const saved=await result.saveAsync({format:SaveFormat.PNG});if(!saved.uri.startsWith(Paths.cache.uri))throw Error('Unexpected editor output location.');const file=new File(saved.uri);const dispose=()=>{if(!saved.uri.startsWith(Paths.cache.uri))throw Error('Unexpected editor output location.');if(file.exists)file.delete()};cleanup=dispose;const size=file.size;cleanup=undefined;return{name:'edited-photo.png',mime:'image/png',size,uri:saved.uri,dispose}}
 catch(error){cleanup?.();throw error}
 finally{source?.release();result?.release();context.release()}
}
