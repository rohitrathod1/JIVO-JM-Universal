import { exportFilename } from '../../passwords/files/exportController'
export function validateAttachmentExportSize(size:number){if(!Number.isSafeInteger(size)||size<0)throw Error('Invalid attachment size.')}
export async function saveAttachment(blob:Blob,name:string,current:()=>boolean){if(!current())throw Error('Attachment export was cancelled.');const uri=URL.createObjectURL(blob);const link=document.createElement('a');try{link.href=uri;link.download=exportFilename(name);document.body.appendChild(link);link.click()}finally{link.remove();window.setTimeout(()=>URL.revokeObjectURL(uri),1000)}}
export function cancelAttachmentExports(){}
export function retryAttachmentCleanup(){}
export function watchAttachmentCleanup(_listener:(error:string)=>void){return()=>{}}
export const attachmentExportNotice='This downloads a copy outside JM. Protect and remove downloaded copies when finished.'
