import type { PickedFile } from '../messenger/media/model'
export async function captureOwnedFrame(current:()=>boolean,io:{capture:()=>Promise<string>;size:(uri:string)=>number;release:(uri:string)=>void}):Promise<PickedFile>{
 if(!current())throw Error('Image editing was cancelled.');const uri=await io.capture();let owned=true;const dispose=()=>{if(owned){io.release(uri);owned=false}}
 try{if(!current())throw Error('Image editing was cancelled.');if(!uri.startsWith('file://'))throw Error('Frame renderer did not return a local file.');const size=io.size(uri);if(!Number.isSafeInteger(size)||size<=0)throw Error('Frame renderer returned an empty image.');return{name:'edited-photo.png',uri,mime:'image/png',size,dispose}}catch(error){dispose();throw error}
}
