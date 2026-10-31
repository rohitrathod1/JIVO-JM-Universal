import { defaultEdit } from './model'
import type { ImageEdit } from './model'
export type CropHandle='move'|'nw'|'ne'|'sw'|'se'
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
export function dragCrop(edit:ImageEdit,handle:CropHandle,dx:number,dy:number):ImageEdit{
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return edit
 if(handle==='move')return {...edit,x:clamp(edit.x+dx,0,1-edit.width),y:clamp(edit.y+dy,0,1-edit.height)}
 let left=edit.x,top=edit.y,right=edit.x+edit.width,bottom=edit.y+edit.height
 if(handle.includes('w'))left=clamp(left+dx,0,right-0.06);else right=clamp(right+dx,left+0.06,1)
 if(handle.includes('n'))top=clamp(top+dy,0,bottom-0.06);else bottom=clamp(bottom+dy,top+0.06,1)
 return {...edit,x:left,y:top,width:right-left,height:bottom-top}
}
export function aspectCrop(edit:ImageEdit,ratio:number,imageRatio:number):ImageEdit{const relative=ratio/imageRatio;const width=Math.min(1,relative),height=Math.min(1,1/relative);return {...edit,x:(1-width)/2,y:(1-height)/2,width,height}}

export class CropGesture { private initial=defaultEdit; begin(edit:ImageEdit){this.initial=edit} move(kind:CropHandle,dx:number,dy:number){return dragCrop(this.initial,kind,dx,dy)} }
