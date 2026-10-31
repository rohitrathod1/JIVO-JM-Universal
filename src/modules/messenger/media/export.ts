import { createNativeExporter } from '../../passwords/files/nativeExport'
import { validateNativeExportSize } from '../../passwords/files/exportController'
import { AppState } from 'react-native'
const messageExports = createNativeExporter('jivo-message-exports','Export message attachment','message attachment')
export const validateAttachmentExportSize=(size:number)=>validateNativeExportSize(size,'message attachment')
export const saveAttachment=(blob:Blob,name:string,current:()=>boolean)=>messageExports.export(blob,name,current)
export function cancelAttachmentExports(){try{messageExports.cancel()}catch{/* Published by cleanup subscription. */}}
export function retryAttachmentCleanup(){try{messageExports.cleanupIdle()}catch{/* Published by cleanup subscription. */}}
export function watchAttachmentCleanup(listener:(error:string)=>void){const off=messageExports.subscribe(listener);const clean=()=>{try{messageExports.resume()}catch{/* Published above. */}};clean();const sub=AppState.addEventListener('change',state=>{if(state==='active')clean()});return()=>{off();sub.remove()}}
export const attachmentExportNotice='This saves a copy outside JM. Choose a trusted destination. Native exports support up to 20 MiB. Temporary app copies are removed after sharing or on next launch after interruption; receiver copies remain outside JM control.'
