export interface ImageEdit { rotation:0|90|180|270; zoom:number; flipX:boolean; flipY:boolean; x:number;y:number;width:number;height:number;frame:'none'|'square'|'thin'|'thick'|'rounded'|'circle' }
export const defaultEdit:ImageEdit={rotation:0,zoom:1,flipX:false,flipY:false,x:0,y:0,width:1,height:1,frame:'none'}
export function cropPixels(width:number,height:number,edit:ImageEdit){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>80_000_000)throw Error('Image dimensions are unsupported (maximum 80 megapixels).')
 if(!Number.isFinite(edit.zoom)||edit.zoom<1||edit.zoom>3||![0,90,180,270].includes(edit.rotation)||[edit.x,edit.y,edit.width,edit.height].some(v=>!Number.isFinite(v))||edit.x<0||edit.y<0||edit.width<=0||edit.height<=0||edit.x+edit.width>1.000001||edit.y+edit.height>1.000001)throw Error('Crop must fit inside the image.')
 edit={...edit,x:0.5+(edit.x-0.5)/edit.zoom,y:0.5+(edit.y-0.5)/edit.zoom,width:edit.width/edit.zoom,height:edit.height/edit.zoom};
 const w=edit.rotation%180?height:width,h=edit.rotation%180?width:height;const originX=Math.min(w-1,Math.floor(w*edit.x)),originY=Math.min(h-1,Math.floor(h*edit.y));return {originX,originY,width:Math.max(1,Math.min(w-originX,Math.round(w*edit.width))),height:Math.max(1,Math.min(h-originY,Math.round(h*edit.height)))}
}
